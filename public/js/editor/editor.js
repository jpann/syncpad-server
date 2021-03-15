"use strict";
function successAlert(e) {
  $("#alert-success-txt").text(e),
    $("#alert-success").show(),
    $("#alert-success")
      .fadeTo(2e3, 500)
      .slideUp(500, function () {
        $("#alert-success").slideUp(500);
      });
}

function errorAlert(e) {
  $("#alert-error-txt").text(e),
    $("#alert-error").show(),
    $("#alert-error")
      .fadeTo(2e3, 500)
      .slideUp(500, function () {
        $("#alert-error").slideUp(500);
      });
}

function generateKey() {
  var e = CryptoJS.lib.WordArray.random(16).toString();
  $("#room-passcode-setting").val(e);
}

function generatePasscode() {
  $("#room-passcode-setting").val(humanReadableIds.random());
}

function encrypt(e, t) {
  return CryptoJS.AES.encrypt(e, t).toString();
}

function decrypt(e, t) {
  return CryptoJS.AES.decrypt(e, t).toString(CryptoJS.enc.Utf8);
}

function updateStatus(e) {
  (e = "[" + moment().local().format("MM/DD/YYYY h:mm:ss a") + "]: " + e),
    $("#status-list").prepend($('<li class="list-group-item">').text(e));
}

function notify(e) {
  $.notify(e, { style: "grey" });
}

function connect(o, n) {
  var s = "",
    r = null,
    a = new Quill("#editor", {
      modules: { toolbar: "#toolbar" },
      theme: "snow",
    }),
    i = io({ query: "&roomId=" + o, reconnectionDelay: 1e4 }),
    c = null;

  function t() {
    var e = $("#chat-panel-msg").val();
    if (e) {
      var t = encrypt(e, s);
      i.emit("chat:msg", { message: t }), $("#chat-panel-msg").val("");
    }
  }
  i.on("connect", function () {
    updateStatus("You connected to the server.");
  }),
    i.on("auth:exchange", function (e, t) {
      var o = e.key;
      updateStatus("Creating public key."),
        (r = bCrypto.createECDH("secp521r1")).generateKeys("hex");
      var n = r.getPublicKey("hex");
      (c = r.computeSecret(o, "hex", "hex")),
        updateStatus("Sending public key."),
        t({ key: n });
    }),
    i.on("room:auth", function (e, t) {
      updateStatus("Initiating room authentication."), t({ passcode: n });
    }),
    i.on("authenticated", function (e) {
      var t = e.key,
        o = e.passcode,
        n = e.username,
        r = e.roomId;
      if ((updateStatus("Finishing key exchange."), c)) {
        var a = decrypt(o, c);
        (s = decrypt(t, c))
          ? (updateStatus("Key exchange complete."),
            updateStatus("You are now authenticated in room " + e.roomId + "."),
            $("#room-id-info").val(r),
            $("#room-passcode-info").val(a),
            $("#room-username-info").val(n),
            $("title").text(n + "@" + r + " - syncpad editor"),
            $("#settings-modal").data()["bs.modal"].isShown &&
              $("#settings-modal").modal("toggle"))
          : updateStatus("Key exchange failed. Failed to decrypt key.");
      } else updateStatus("Key exchange failed. Secret is not defined.");
    }),
    i.on("unauthorized", function (e) {
      var t = e.message;
      e.roomId;
      updateStatus("You are not authorized in room " + e.roomId + ": " + t),
        errorAlert("You are not authorized in room " + e.roomId + ": " + t);
    }),
    i.on("connect_error", function (e) {
      updateStatus("connect_error: " + e.error),
        errorAlert("connect_error: " + e.error);
    }),
    i.on("connect_timeout", function (e) {
      updateStatus("connect_timeout: " + e.error),
        errorAlert("connect_timeout: " + e.error);
    }),
    i.on("error", function (e) {
      updateStatus("Error: " + e.error), errorAlert("Error: " + e.error);
    }),
    i.on("disconnect", function (e) {
      updateStatus("Disconnected from server.");
    }),
    i.on("room:join", function (e) {
      updateStatus("User " + e.user + " joined the room."),
        notify("User " + e.user + " joined the room.");
    }),
    i.on("room:leave", function (e) {
      updateStatus("User " + e.user + " left the room from."),
        notify("User " + e.user + " left the room.");
    }),
    i.on("text:latest", function (e) {
      e.user;
      var t = e.id,
        o = a.getContents(),
        n = encrypt((e = JSON.stringify(o)), s);
      console.log("text:latest: " + e),
        i.emit("text:refresh", { id: t, text: n });
    }),
    i.on("text", function (e) {
      e.user;
      var t = decrypt(e.text, s);
      e = JSON.parse(t);
      console.log("text => " + JSON.stringify(e)),
        a.updateContents(e, "silent");
    }),
    i.on("text:typing", function (e) {}),
    i.once("text:refresh", function (e) {
      var t = decrypt(e.text, s);
      if (t) {
        e = JSON.parse(t);
        console.log("text:refresh: " + t), a.setContents(e, "silent");
      } else updateStatus("Editor refresh failed.");
    }),
    i.on("chat:msg", function (e) {
      var t = e.user;
      !(function (e, t) {
        t = sanitizeHtml(t);
        var o =
          '<p class="list-group-item-heading"><p style="font-size: 15px; color: #1ac6ff">' +
          e +
          '</p></p>\n                <p class="list-group-item-text" style="text-align: left; ">' +
          t +
          ' <span style="float: right; font-size: 9px; color: #B0B0B0">' +
          moment().local().format("h:mm:ss a") +
          "</span></p>";
        $("#chat-panel-messages").append(
          $('<li class="list-group-item">').html(o)
        ),
          $("#chat-panel-body").scrollTop(
            $("#chat-panel-body")[0].scrollHeight
          );
      })(t, decrypt(e.message, s)),
        t != $("#room-username-info").val() &&
          notify("Message from " + t + ".");
    }),
    a.on("text-change", function (e, t, o) {
      if ("user" == o) {
        var n = e,
          r = encrypt(JSON.stringify(n), s);
        i.emit("text", { text: r });
      }
    }),
    a.on("selection-change", function (e, t, o) {
      e && i.emit("text:typing");
    }),
    $("#users-button").click(function () {
      i.emit("users:list", null, function (o) {
        $("#user-table tbody").empty(),
          $.each(o, function (e) {
            var t = o[e];
            $("#user-table tbody").append(
              "\n                    <tr>\n                        <td>" +
                t.username +
                "</td>\n                        <td>" +
                moment(t.connectedTime).local().fromNow() +
                "</td>\n                        <td>" +
                moment(t.lastUpdateTime).local().fromNow() +
                "</td>\n                    </tr>\n                    "
            );
          }),
          $("#users-modal").modal("toggle");
      });
    }),
    $("#room-username-change").click(function () {
      var e = $("#room-username-info").val();
      e &&
        i.emit("chat:name change", { username: e }, function (e, t) {
          e
            ? (console.log("username already exists in room."),
              $("#room-username-info").val(t.username))
            : ($("#room-username-info").val(t.username),
              $("title").text(t.username + "@" + o + " - syncpad editor"));
        });
    }),
    $("#chat-panel-send").click(function () {
      t();
    }),
    $("#chat-panel-msg").on("keydown", function (e) {
      13 == e.which && t();
    });
}
$(function () {
  $("#alert-error").hide(),
    $.notify.addStyle("grey", {
      html: "<div><span data-notify-text/></div>",
      classes: {
        base: {
          "white-space": "nowrap",
          "background-color": "#B6E2FE",
          padding: "5px",
          color: "#000000",
          border: "1px solid #000000",
          "border-radius": "4px",
        },
      },
    }),
    $.notify.defaults({ globalPosition: "bottom right", autoHideDelay: 2e3 }),
    $("#share-url").val(window.location.href),
    $("#settings-modal").modal("show"),
    $("#generate-key")
      .popover()
      .click(function () {
        setTimeout(function () {
          $("#generate-key").popover("hide");
        }, 2e3);
      }),
    $("#chat-button").click(function () {
      $("#chat-modal").modal("toggle");
    }),
    $("#info-button").click(function () {
      $("#info-modal").modal("toggle");
    }),
    $("#debug-info-button").click(function () {
      $("#debug-modal").modal("toggle");
    }),
    $(".generate-key").click(function () {
      generateKey();
    }),
    $(".generate-passcode").click(function () {
      generatePasscode();
    }),
    $("#cancel").click(function () {
      window.location.replace("/");
    }),
    $(".connect").click(function () {
      var e = $("#room-passcode-setting").val();
      if (e && 6 <= e.length) {
        $("#passcode").val(e);
        var t = $("#roomId").val();
        t && e
          ? (updateStatus("Connecting to room " + t + "..."), connect(t, e))
          : errorAlert("Error: Invalid room ID or passcode.");
      } else errorAlert("Please provide a passcode that is more than 6 characters.");
    });
}),
  $(".alert .close").on("click", function (e) {
    $(this).parent().hide();
  });
