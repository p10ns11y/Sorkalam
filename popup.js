/**
 * Sorkalam - Tamil ↔ English Lookup Extension (Manifest V3)
 * Author : Peramanathan Sathyamoorthy
 */

wiki = 0;
tvu = 0;
newURL = "";
smartLook = "";
language = "";
frm = "en";
_frm = "";
des = "ta";
from = "eng";
dest = "ta";
keys = [];

$(document).ready(function () {

    document.getElementById('word').focus();
    $('#user_tip').hide();

    $('#tiptext').click(function () {
        var action = $('#tiptext').text();
        if (action === "--{ show tips }--") {
            $('#tiptext').text('--} hide tips {--');
            $('#user_tip').slideDown();
        } else {
            $('#tiptext').text('--{ show tips }--');
            $('#user_tip').slideUp();
        }
    });

    $('#player').hide();
    $('#play_word').hide();
    $('.word_player').hide();
    $('#results').hide();

    $('.word_player').click(function () {
        if (language === "english") {
            var enWord = "https://ssl.gstatic.com/dictionary/static/sounds/de/0/" + smartLook + ".mp3";
            document.getElementById('play_word').innerHTML = '<source src=' + enWord + ' type="audio/mpeg">';
            $('#play_word').load();
        }
        var audioEm = document.getElementById('play_word');
        audioEm.play();
    });

    // === MODERN MV3: Get selected text when popup opens ===
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs[0]) return;

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
        }, function (results) {
            if (results && results[0] && results[0].result) {
                const selectedText = results[0].result.trim();
                if (selectedText) {
                    smartLook = filter(selectedText);
                    document.getElementById('word').value = smartLook;

                    // Auto-trigger Wiktionary lookup
                    newURL = "http://ta.wiktionary.org/wiki/" + smartLook;
                    wiki = 1;
                    wikiRawParse(smartLook);
                }
            }
        });
    });

    $(document).keydown(function (e) {
        keys[e.keyCode] = true;
        var enteredTxt = document.getElementById('word').value;
        smartLook = filter(enteredTxt);

        if (keys[13] && smartLook != "") {
            newURL = "http://ta.wiktionary.org/wiki/" + smartLook;
            document.getElementById('word').value = smartLook;
            wiki = 1;
            wikiRawParse(smartLook);
        }
    });

    $(document).keyup(function (e) {
        keys[e.keyCode] = false;
    });

    // === Wiktionary Button ===
    $("#wiki_lookup").click(function () {
        smartLook = filter(document.getElementById('word').value);
        if (!smartLook) return;

        console.log("Wiki lookup:", smartLook);
        newURL = "http://ta.wiktionary.org/wiki/" + smartLook;
        wiki = 1;
        wikiRawParse(smartLook);
    });

    // === Tamil VU Glossary Button ===
    $("#tvu_lookup").click(function () {
        tvu = 1;
        smartLook = filter(document.getElementById('word').value);
        if (!smartLook) return;

        var baseTVURL = "http://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp?selsub=All&schsel=full&editor=";

        if (language === 'tamil') {
            newURL = baseTVURL + smartLook + "&key_sel=Tamil";
        } else if (language === 'english') {
            newURL = baseTVURL + smartLook + "&key_sel=English";
        } else {
            newURL = '';
        }

        if (smartLook !== "") {
            tvuGlosSearch(smartLook);
        }
    });

    $('#results').on('click', 'a', function () {
        var URL = $(this).attr('href');
        var word = $(this).text();
        if (URL === '#') {
            document.getElementById('word').value = filter(word);
            smartLook = document.getElementById('word').value;
            newURL = "http://ta.wiktionary.org/wiki/" + smartLook;
            wiki = 1;
            wikiRawParse(smartLook);
        }
    });

    $('#newtab').on('click', 'a', function () {
        var URL = $(this).attr('href');
        if (URL !== '') chrome.tabs.create({ url: URL, active: false });
    });

});

// === Language Detection ===
filter = function (lookup) {
    if (!lookup) return "";

    var rmSpace = /\s/gi;
    var rmSpecial = /[\`\\~\!\@\#\$\%\&\*\(\)\-\_\+\=\{\}\[\]\:\;\"\'\,\.\<\>\?\/\|\^0-9]/gi;

    var _clnTxt = lookup.replace(rmSpecial, '').replace(rmSpace, '');
    var len = _clnTxt.length;
    var hashAdd = 0;

    for (var i = 0; i < len; i++) {
        hashAdd += _clnTxt.charCodeAt(i);
    }

    if (hashAdd >= len * 2944 && hashAdd <= len * 3071) {
        language = "tamil";
        frm = "ta"; from = "ta";
        des = "en"; dest = "eng";
        $('#lan_indicator').css("color", "darkgreen");
        $('.word_player').hide();
    }
    else if (hashAdd >= len * 32 && hashAdd <= len * 127) {
        language = "english";
        lookup = lookup.toLowerCase();
        frm = "en"; from = "eng";
        des = "ta"; dest = "ta";
        $('#lan_indicator').css("color", "darkgreen");
        $('.word_player').show();
    }
    else {
        language = "mixed";
        $('#lan_indicator').css("color", "red");
        $('.word_player').hide();
    }

    lookup = lookup.replace(rmSpecial, '').replace(/^\s+|\s+$/gi, '').replace(/\s+/gi, ' ');
    return lookup;
};

// === Wiktionary Lookup ===
function wikiRawParse(lookup) {
    if (!lookup) {
        $('#helpdisplay').hide();
        document.getElementById('results').innerHTML = "<p>No Results Found !</p>";
        return;
    }

    console.log("wiki parse begins ...");
    var baseURL = "https://" + des + ".wiktionary.org/w/api.php?action=parse&prop=text|revid|displaytitle&format=json&page=" + lookup;

    var data = '';

    var xhr = new XMLHttpRequest();
    xhr.open("GET", baseURL, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var text = JSON.parse(xhr.responseText);
            if (text.hasOwnProperty("parse")) {
                data = text.parse.text['*'];
            }
        }
    };
    xhr.send();

    var xhr2 = new XMLHttpRequest();
    var baseURL2 = "https://" + frm + ".wiktionary.org/w/api.php?action=parse&prop=text|revid|displaytitle&format=json&page=" + lookup;

    xhr2.open("GET", baseURL2, true);
    xhr2.onreadystatechange = function () {
        if (xhr2.readyState == 4 && xhr2.status == 200) {
            var text = JSON.parse(xhr2.responseText);
            if (text.hasOwnProperty("parse")) {
                data += text.parse.text['*'];
                data = data.replace(/href="[^>]*"/gi, 'href="#"')
                           .replace(/\/\/upload/gi, 'http://upload')
                           .replace(/style="[^>]*"/gi, '')
                           .replace(/width="[^>]*"/gi, '');
                result(data);
            } else if (data === '') {
                result("missing");
            }
        }
    };
    xhr2.send();
}

// === Tamil VU Glossary Lookup ===
function tvuGlosSearch(lookup) {
    if (!lookup) {
        $('#helpdisplay').hide();
        document.getElementById('results').innerHTML = "<p>No Results Found !</p>";
        return;
    }

    var url = newURL;
    $.ajax({
        type: 'GET',
        url: url,
        success: result
    });
}

// === Result Renderer ===
function result(data) {
    if (data !== null) {
        console.log('AJAX success');

        $('#user_tip').hide();
        $('#helpdisplay').show();
        $('#player').show();
        $('#results').show();

        _frm = frm.replace('ta', 'தமிழ்').replace('en', 'English');
        var notification = " Result for <b>" + smartLook + "</b> (" + _frm + ")";
        document.getElementById('lan_indicator').innerHTML = notification;

        var headEl = document.getElementById('newtab');
        var hypLink = '';
        var elRes = '';

        // Wiktionary result
        if (wiki === 1) {
            hypLink = '<a href="' + newURL + '" data-role="button">விரிவாக @ Wikitionary=></a>';
            headEl.innerHTML = hypLink;

            if (data === "missing") {
                elRes = '';
            } else {
                var wParsedText = document.createElement('div');
                wParsedText.innerHTML = data;

                var imgRes = document.getElementById('img_results');
                imgRes.innerHTML = '';

                $(wParsedText).find('ol').each(function () {
                    $(wParsedText).find('li ul').each(function () {
                        $(this).hide();
                    });
                    elRes += '<ol>' + $(this).html() + '</ol>';
                });

                if (elRes === '' || language === 'tamil') {
                    $(wParsedText).find('ul').each(function () {
                        elRes += '<ul>' + $(this).html() + '</ul>';
                    });
                } else if (elRes === '') {
                    $(wParsedText).find('p').each(function () {
                        elRes += '<ul>' + $(this).html() + '</ul>';
                    });
                }

                document.getElementById('results').innerHTML = elRes;
            }
            wiki = 0;
        }

        // Tamil VU result
        if (tvu === 1) {
            var tvuData = document.createElement('div');
            tvuData.innerHTML = data;
            var tableData = tvuData.getElementsByTagName('tr');
            var len = tableData.length;
            var rowData = '';
            var subjects = [];
            var indx = language === "tamil" ? 3 : 4;
            elRes = '';

            for (var i = 0; i < len; i++) {
                rowData = tableData[i].getElementsByTagName('td')[indx].innerHTML.replace(/<[^>]*>/gi, "");
                subjects.push(tableData[i].getElementsByTagName('td')[2].innerHTML.replace(/<[^>]*>/gi, ""));
                elRes += '<li>' + rowData + ' <i>{' + subjects[i] + ' }</i>' + '</li>';
            }

            document.getElementById('results').innerHTML = '<ol>' + elRes + '</ol>';
            hypLink = '<a href="' + newURL + '">தமிழ் இணையக் கல்விக்கழகம்</a>';
            headEl.innerHTML = hypLink;
            tvu = 0;
        }

        if (!elRes) {
            document.getElementById('results').innerHTML = "<p>No Results Found !</p>";
        }
    } else {
        $('#user_tip').hide();
        $('#results').show();
        document.getElementById('results').innerHTML = "<p>No Results Found !</p>";
    }
}
