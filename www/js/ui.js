/* window focus/blur */
$(window).focus(function() {
    FOCUSED = true;
    clearInterval(TITLE_BLINK);
    TITLE_BLINK = false;
    document.title = PAGETITLE;
}).blur(function() {
    FOCUSED = false;
});

$("#togglemotd").click(function () {
    var hidden = $("#motd").css("display") === "none";
    $("#motd").toggle();
    if (hidden) {
        $("#togglemotd").find(".glyphicon-plus")
            .removeClass("glyphicon-plus")
            .addClass("glyphicon-minus");
    } else {
        $("#togglemotd").find(".glyphicon-minus")
            .removeClass("glyphicon-minus")
            .addClass("glyphicon-plus");
    }
});

/* chatbox */

$("#modflair").click(function () {
    var m = $("#modflair");
    if (m.hasClass("label-success")) {
        USEROPTS.modhat = false;
        m.removeClass("label-success")
         .addClass("label-default");
    } else {
        USEROPTS.modhat = true;
        m.removeClass("label-default")
         .addClass("label-success");
    }
});

$("#adminflair").click(function () {
    var m = $("#adminflair");
    if (m.hasClass("label-danger")) {
        USEROPTS.adminhat = false;
        m.removeClass("label-danger")
         .addClass("label-default");
    } else {
        USEROPTS.adminhat = true;
        m.removeClass("label-default")
         .addClass("label-danger");
    }
});

$("#usercount").mouseenter(function (ev) {
    var breakdown = calcUserBreakdown();
    // re-using profile-box class for convenience
    var popup = $("<div/>")
        .addClass("profile-box")
        .css("top", (ev.clientY + 5) + "px")
        .css("left", (ev.clientX) + "px")
        .appendTo($("#usercount"));

    var contents = "";
    for(var key in breakdown) {
        contents += "<strong>" + key + ":&nbsp;</strong>" + breakdown[key];
        contents += "<br>"
    }

    popup.html(contents);
});

$("#usercount").mousemove(function (ev) {
    var popup = $("#usercount").find(".profile-box");
    if(popup.length == 0)
        return;

    popup.css("top", (ev.clientY + 5) + "px");
    popup.css("left", (ev.clientX) + "px");
});

$("#usercount").mouseleave(function () {
    $("#usercount").find(".profile-box").remove();
});

$("#messagebuffer").mouseenter(function() { SCROLLCHAT = false; });
$("#messagebuffer").mouseleave(function() { SCROLLCHAT = true; });

$("#guestname").keydown(function (ev) {
    if (ev.keyCode === 13) {
        socket.emit("login", {
            name: $("#guestname").val()
        });
    }
});

function chatTabComplete() {
    var words = $("#chatline").val().split(" ");
    var current = words[words.length - 1].toLowerCase();
    if (!current.match(/^[\w-]{1,20}$/)) {
        return;
    }

    var __slice = Array.prototype.slice;
    var usersWithCap = __slice.call($("#userlist").children()).map(function (elem) {
        return elem.children[1].innerHTML;
    });
    var users = __slice.call(usersWithCap).map(function (user) {
        return user.toLowerCase();
    }).filter(function (name) {
        return name.indexOf(current) === 0;
    });

    // users now contains a list of names that start with current word

    if (users.length === 0) {
        return;
    }

    // trim possible names to the shortest possible completion
    var min = Math.min.apply(Math, users.map(function (name) {
        return name.length;
    }));
    users = users.map(function (name) {
        return name.substring(0, min);
    });

    // continually trim off letters until all prefixes are the same
    var changed = true;
    var iter = 21;
    while (changed) {
        changed = false;
        var first = users[0];
        for (var i = 1; i < users.length; i++) {
            if (users[i] !== first) {
                changed = true;
                break;
            }
        }

        if (changed) {
            users = users.map(function (name) {
                return name.substring(0, name.length - 1);
            });
        }

        // In the event something above doesn't generate a break condition, limit
        // the maximum number of repetitions
        if (--iter < 0) {
            break;
        }
    }

    current = users[0].substring(0, min);
    for (var i = 0; i < usersWithCap.length; i++) {
        if (usersWithCap[i].toLowerCase() === current) {
            current = usersWithCap[i];
            break;
        }
    }

    if (users.length === 1) {
        if (words.length === 1) {
            current += ":";
        }
        current += " ";
    }
    words[words.length - 1] = current;
    $("#chatline").val(words.join(" "));
}

$("#chatline").keydown(function(ev) {
    // Enter/return
    if(ev.keyCode == 13) {
        if (CHATTHROTTLE) {
            return;
        }
        var msg = $("#chatline").val();
        if(msg.trim()) {
            var meta = {};
            if (USEROPTS.adminhat && CLIENT.rank >= 255) {
                msg = "/a " + msg;
            } else if (USEROPTS.modhat && CLIENT.rank >= Rank.Moderator) {
                meta.modflair = CLIENT.rank;
            }

            // The /m command no longer exists, so emulate it clientside
            if (CLIENT.rank >= 2 && msg.indexOf("/m ") === 0) {
                meta.modflair = CLIENT.rank;
                msg = msg.substring(3);
            }

            socket.emit("chatMsg", {
                msg: msg,
                meta: meta
            });
            CHATHIST.push($("#chatline").val());
            CHATHISTIDX = CHATHIST.length;
            $("#chatline").val("");
        }
        return;
    }
    else if(ev.keyCode == 9) { // Tab completion
        chatTabComplete();
        ev.preventDefault();
        return false;
    }
    else if(ev.keyCode == 38) { // Up arrow (input history)
        if(CHATHISTIDX == CHATHIST.length) {
            CHATHIST.push($("#chatline").val());
        }
        if(CHATHISTIDX > 0) {
            CHATHISTIDX--;
            $("#chatline").val(CHATHIST[CHATHISTIDX]);
        }

        ev.preventDefault();
        return false;
    }
    else if(ev.keyCode == 40) { // Down arrow (input history)
        if(CHATHISTIDX < CHATHIST.length - 1) {
            CHATHISTIDX++;
            $("#chatline").val(CHATHIST[CHATHISTIDX]);
        }

        ev.preventDefault();
        return false;
    }
});

/* poll controls */
$("#newpollbtn").click(showPollMenu);

/* search controls */
$("#library_search").click(function() {
    if (!hasPermission("seeplaylist")) {
        $("#searchcontrol .alert").remove();
        var al = makeAlert("Permission Denied",
            "This channel does not allow you to search its library",
            "alert-danger");
        al.find(".alert").insertAfter($("#library_query").parent());
        return;
    }

    socket.emit("searchMedia", {
        source: "library",
        query: $("#library_query").val().toLowerCase()
    });
});

$("#library_query").keydown(function(ev) {
    if(ev.keyCode == 13) {
        if (!hasPermission("seeplaylist")) {
            $("#searchcontrol .alert").remove();
            var al = makeAlert("Permission Denied",
                "This channel does not allow you to search its library",
                "alert-danger");
            al.find(".alert").insertAfter($("#library_query").parent());
            return;
        }

        socket.emit("searchMedia", {
            source: "library",
            query: $("#library_query").val().toLowerCase()
        });
    }
});

$("#youtube_search").click(function () {
    var query = $("#library_query").val().toLowerCase();
    if(parseMediaLink(query).type !== null) {
        makeAlert("Media Link", "If you already have the link, paste it " +
                  "in the 'Media URL' box under Playlist Controls.  This "+
                  "searchbar works like YouTube's search function.",
                  "alert-danger")
            .insertBefore($("#library"));
    }

    socket.emit("searchMedia", {
        source: "yt",
        query: query
    });
});

/* user playlists */

$("#userpl_save").click(function() {
    if($("#userpl_name").val().trim() == "") {
        makeAlert("Invalid Name", "Playlist name cannot be empty", "alert-danger")
            .insertAfter($("#userpl_save").parent());
        return;
    }
    socket.emit("clonePlaylist", {
        name: $("#userpl_name").val()
    });
});

/* video controls */

$("#mediarefresh").click(function() {
    PLAYER.type = "";
    PLAYER.id = "";
    // playerReady triggers the server to send a changeMedia.
    // the changeMedia handler then reloads the player
    socket.emit("playerReady");
});

/* playlist controls */

$("#queue").sortable({
    start: function(ev, ui) {
        PL_FROM = ui.item.data("uid");
    },
    update: function(ev, ui) {
        var prev = ui.item.prevAll();
        if(prev.length == 0)
            PL_AFTER = "prepend";
        else
            PL_AFTER = $(prev[0]).data("uid");
        socket.emit("moveMedia", {
            from: PL_FROM,
            after: PL_AFTER
        });
        $("#queue").sortable("cancel");
    }
});
$("#queue").disableSelection();

function queue(pos, src) {
    if (!src) {
        src = "url";
    }

    if (src === "customembed") {
        var title = $("#customembed-title").val();
        if (!title) {
            title = false;
        }
        var content = $("#customembed-content").val();

        socket.emit("queue", {
            id: content,
            title: title,
            pos: pos,
            type: "cu",
            temp: $(".add-temp").prop("checked")
        });
    } else {
        var link = $("#mediaurl").val();
        var data = parseMediaLink(link);
        var duration = undefined;
        var title = undefined;
        if (link.indexOf("jw:") === 0) {
            duration = parseInt($("#addfromurl-duration-val").val());
            if (duration <= 0 || isNaN(duration)) {
                duration = undefined;
            }
        }
        if (data.type === "fi") {
            title = $("#addfromurl-title-val").val();
        }

        if (data.id == null || data.type == null) {
            makeAlert("Error", "Failed to parse link.  Please check that it is correct",
                      "alert-danger")
                .insertAfter($("#addfromurl"));
        } else {
            $("#mediaurl").val("");
            $("#addfromurl-duration").remove();
            $("#addfromurl-title").remove();
            socket.emit("queue", {
                id: data.id,
                type: data.type,
                pos: pos,
                duration: duration,
                title: title,
                temp: $(".add-temp").prop("checked")
            });
        }
    }
}

$("#queue_next").click(queue.bind(this, "next", "url"));
$("#queue_end").click(queue.bind(this, "end", "url"));
$("#ce_queue_next").click(queue.bind(this, "next", "customembed"));
$("#ce_queue_end").click(queue.bind(this, "end", "customembed"));

$("#mediaurl").keydown(function(ev) {
    if (ev.keyCode === 13) {
        queue("end", "url");
    } else {
        if ($("#mediaurl").val().indexOf("jw:") === 0) {
            var duration = $("#addfromurl-duration");
            if (duration.length === 0) {
                duration = $("<div/>")
                    .attr("id", "addfromurl-duration")
                    .appendTo($("#addfromurl"));
                $("<span/>").text("JWPlayer Duration (seconds) (optional)")
                    .appendTo(duration);
                $("<input/>").addClass("form-control")
                    .attr("type", "text")
                    .attr("id", "addfromurl-duration-val")
                    .appendTo($("#addfromurl-duration"));
            }
        } else {
            $("#addfromurl-duration").remove();
        }

        var url = $("#mediaurl").val().split("?")[0];
        if (url.match(/^https?:\/\/(.*)?\.(flv|mp4|og[gv]|webm|mp3|mov)$/)) {
            var title = $("#addfromurl-title");
            if (title.length === 0) {
                title = $("<div/>")
                    .attr("id", "addfromurl-title")
                    .appendTo($("#addfromurl"));
                $("<span/>").text("Title (optional)")
                    .appendTo(title);
                $("<input/>").addClass("form-control")
                    .attr("type", "text")
                    .attr("id", "addfromurl-title-val")
                    .keydown(function (ev) {
                        if (ev.keyCode === 13) {
                            queue("end", "url");
                        }
                    })
                    .appendTo($("#addfromurl-title"));
            }
        } else {
            $("#addfromurl-title").remove();
        }
    }
});

$("#customembed-content").keydown(function(ev) {
    if (ev.keyCode === 13) {
        queue("end", "customembed");
    }
});

$("#qlockbtn").click(function() {
    socket.emit("togglePlaylistLock");
});

$("#voteskip").click(function() {
    socket.emit("voteskip");
    $("#voteskip").attr("disabled", true);
});

$("#getplaylist").click(function() {
    var callback = function(data) {
        hidePlayer();
        socket.listeners("playlist").splice(
            socket.listeners("playlist").indexOf(callback)
        );
        var list = [];
        for(var i = 0; i < data.length; i++) {
            var entry = formatURL(data[i].media);
            list.push(entry);
        }
        var urls = list.join(",");

        var outer = $("<div/>").addClass("modal fade")
            .appendTo($("body"));
        modal = $("<div/>").addClass("modal-dialog").appendTo(outer);
        modal = $("<div/>").addClass("modal-content").appendTo(modal);
        var head = $("<div/>").addClass("modal-header")
            .appendTo(modal);
        $("<button/>").addClass("close")
            .attr("data-dismiss", "modal")
            .attr("aria-hidden", "true")
            .html("&times;")
            .appendTo(head);
        $("<h3/>").text("Playlist URLs").appendTo(head);
        var body = $("<div/>").addClass("modal-body").appendTo(modal);
        $("<input/>").addClass("form-control").attr("type", "text")
            .val(urls)
            .appendTo(body);
        $("<div/>").addClass("modal-footer").appendTo(modal);
        outer.on("hidden", function() {
            outer.remove();
            unhidePlayer();
        });
        outer.modal();
    };
    socket.on("playlist", callback);
    socket.emit("requestPlaylist");
});

$("#clearplaylist").click(function() {
    var clear = confirm("Are you sure you want to clear the playlist?");
    if(clear) {
        socket.emit("clearPlaylist");
    }
});

$("#shuffleplaylist").click(function() {
    var shuffle = confirm("Are you sure you want to shuffle the playlist?");
    if(shuffle) {
        socket.emit("shufflePlaylist");
    }
});

/* load channel */

var loc = document.location+"";
var m = loc.match(/\/r\/([a-zA-Z0-9-_]+)/);
if(m) {
    CHANNEL.name = m[1];
    if (CHANNEL.name.indexOf("#") !== -1) {
        CHANNEL.name = CHANNEL.name.substring(0, CHANNEL.name.indexOf("#"));
    }
}

/* channel ranks stuff */
function chanrankSubmit(rank) {
    var name = $("#cs-chanranks-name").val();
    socket.emit("setChannelRank", {
        name: name,
        rank: rank
    });
}
$("#cs-chanranks-mod").click(chanrankSubmit.bind(this, 2));
$("#cs-chanranks-adm").click(chanrankSubmit.bind(this, 3));
$("#cs-chanranks-owner").click(chanrankSubmit.bind(this, 4));

["#showmediaurl", "#showsearch", "#showcustomembed", "#showplaylistmanager"]
    .forEach(function (id) {
    $(id).click(function () {
        var wasActive = $(id).hasClass("active");
        $(".plcontrol-collapse").collapse("hide");
        $("#plcontrol button.active").button("toggle");
        if (!wasActive) {
            $(id).button("toggle");
        }
    });
});
$("#plcontrol button").button();
$("#plcontrol button").button("hide");
$(".plcontrol-collapse").collapse();
$(".plcontrol-collapse").collapse("hide");

$(".cs-checkbox").change(function () {
    var box = $(this);
    var key = box.attr("id").replace("cs-", "");
    var value = box.prop("checked");
    var data = {};
    data[key] = value;
    socket.emit("setOptions", data);
});

$(".cs-textbox").keydown(function () {
    var box = $(this);
    var key = box.attr("id").replace("cs-", "");
    var value = box.val();
    var lastkey = Date.now();
    box.data("lastkey", lastkey);

    setTimeout(function () {
        if (box.data("lastkey") !== lastkey || box.val() !== value) {
            return;
        }

        var data = {};
        if (key.match(/chat_antiflood_(burst|sustained)/)) {
            data = {
                chat_antiflood_params: {
                    burst: $("#cs-chat_antiflood_burst").val(),
                    sustained: $("#cs-chat_antiflood_sustained").val()
                }
            };
        } else {
            data[key] = value;
        }
        socket.emit("setOptions", data);
    }, 1000);
});

$("#cs-chanlog-refresh").click(function () {
    socket.emit("readChanLog");
});

$("#cs-chanlog-filter").change(filterChannelLog);

$("#cs-motdsubmit").click(function () {
    socket.emit("setMotd", {
        motd: $("#cs-motdtext").val()
    });
});

$("#cs-csssubmit").click(function () {
    socket.emit("setChannelCSS", {
        css: $("#cs-csstext").val()
    });
});

$("#cs-jssubmit").click(function () {
    socket.emit("setChannelJS", {
        js: $("#cs-jstext").val()
    });
});

$("#cs-chatfilters-newsubmit").click(function () {
    var name = $("#cs-chatfilters-newname").val();
    var regex = $("#cs-chatfilters-newregex").val();
    var flags = $("#cs-chatfilters-newflags").val();
    var replace = $("#cs-chatfilters-newreplace").val();
    var entcheck = checkEntitiesInStr(regex);
    if (entcheck) {
        alert("Warning: " + entcheck.src + " will be replaced by " +
              entcheck.replace + " in the message preprocessor.  This " +
              "regular expression may not match what you intended it to " +
              "match.");
    }

    socket.emit("addFilter", {
        name: name,
        source: regex,
        flags: flags,
        replace: replace,
        active: true
    });

    socket.once("addFilterSuccess", function () {
        $("#cs-chatfilters-newname").val("");
        $("#cs-chatfilters-newregex").val("");
        $("#cs-chatfilters-newflags").val("");
        $("#cs-chatfilters-newreplace").val("");
    });
});

$("#cs-emotes-newsubmit").click(function () {
    var name = $("#cs-emotes-newname").val();
    var image = $("#cs-emotes-newimage").val();

    socket.emit("updateEmote", {
        name: name,
        image: image,
    });

    $("#cs-emotes-newname").val("");
    $("#cs-emotes-newimage").val("");
});

$("#cs-chatfilters-export").click(function () {
    var callback = function (data) {
        socket.listeners("chatFilters").splice(
            socket.listeners("chatFilters").indexOf(callback)
        );

        $("#cs-chatfilters-exporttext").val(JSON.stringify(data));
    };

    socket.on("chatFilters", callback);
    socket.emit("requestChatFilters");
});

$("#cs-chatfilters-import").click(function () {
    var text = $("#cs-chatfilters-exporttext").val();
    var choose = confirm("You are about to import filters from the contents of the textbox below the import button.  If this is empty, it will clear all of your filters.  Are you sure you want to continue?");
    if (!choose) {
        return;
    }

    if (text.trim() === "") {
        text = "[]";
    }

    var data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        alert("Invalid import data: " + e);
        return;
    }

    socket.emit("importFilters", data);
});

$("#cs-emotes-export").click(function () {
    var em = CHANNEL.emotes.map(function (f) {
        return {
            name: f.name,
            image: f.image
        };
    });
    $("#cs-emotes-exporttext").val(JSON.stringify(em));
});

$("#cs-emotes-import").click(function () {
    var text = $("#cs-emotes-exporttext").val();
    var choose = confirm("You are about to import emotes from the contents of the textbox below the import button.  If this is empty, it will clear all of your emotes.  Are you sure you want to continue?");
    if (!choose) {
        return;
    }

    if (text.trim() === "") {
        text = "[]";
    }

    var data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        alert("Invalid import data: " + e);
        return;
    }

    socket.emit("importEmotes", data);
});

var toggleUserlist = function () {
    var direction = !USEROPTS.layout.match(/synchtube/) ? "glyphicon-chevron-right" : "glyphicon-chevron-left"
    if ($("#userlist").css("display") === "none") {
        $("#userlist").show();
        $("#userlisttoggle").removeClass(direction).addClass("glyphicon-chevron-down");
    } else {
        $("#userlist").hide();
        $("#userlisttoggle").removeClass("glyphicon-chevron-down").addClass(direction);
    }
    scrollChat();
};

$("#usercount").click(toggleUserlist);
$("#userlisttoggle").click(toggleUserlist);

$(".add-temp").change(function () {
    $(".add-temp").prop("checked", $(this).prop("checked"));
});

/*
 * Fixes #417 which is caused by changes in Bootstrap 3.3.0
 * (see twbs/bootstrap#15136)
 *
 * Whenever the active tab in channel options is changed,
 * the modal must be updated so that the backdrop is resized
 * appropriately.
 */
$("#channeloptions li > a[data-toggle='tab']").on("shown.bs.tab", function () {
    $("#channeloptions").data("bs.modal").handleUpdate();
});

applyOpts();

(function () {
    if (typeof window.MutationObserver === "function") {
        var mr = new MutationObserver(function (records) {
            records.forEach(function (record) {
                if (record.type !== "childList") return;
                if (!record.addedNodes || record.addedNodes.length === 0) return;

                var elem = record.addedNodes[0];
                if (elem.id === "ytapiplayer") handleVideoResize();
            });
        });

        mr.observe($("#videowrap").find(".embed-responsive")[0], { childList: true });
    } else {
        /*
         * DOMNodeInserted is deprecated.  This code is here only as a fallback
         * for browsers that do not support MutationObserver
         */
        $("#videowrap").find(".embed-responsive")[0].addEventListener("DOMNodeInserted", function (ev) {
            if (ev.target.id === "ytapiplayer") handleVideoResize();
        });
    }
})();
