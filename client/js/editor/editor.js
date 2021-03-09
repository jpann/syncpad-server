$(function()
{
    $('#alert-error').hide();

    $.notify.addStyle('grey',
        {
            html: "<div><span data-notify-text/></div>",
            classes: {
                base: {
                    "white-space": "nowrap",
                    "background-color": "#B6E2FE",
                    "padding": "5px",
                    "color": "#000000",
                    "border": "1px solid #000000",
                    "border-radius": "4px"
                }
            },
        });

    $.notify.defaults(
        {
            globalPosition: 'bottom right',
            autoHideDelay: 2000,
        });

    $('#share-url').val(window.location.href);

    $('#settings-modal').modal('show');

    $('#generate-key').popover().click(function() 
    {
        setTimeout(function()
        {
            $('#generate-key').popover('hide');
        }, 2000);
    });

    $('#chat-button').click(function()
    {
        $('#chat-modal').modal('toggle');
    });

    $('#info-button').click(function()
    {
        $('#info-modal').modal('toggle');
    });

    $('#debug-info-button').click(function()
    {
        $('#debug-modal').modal('toggle');
    });

    $('.generate-key').click(function()
    {
        generateKey();
    });

    $('.generate-passcode').click(function()
    {
        generatePasscode();
    });

    $('#cancel').click(function()
    {
        window.location.replace("/");
    });

    $('.connect').click(function()
    {
        var passcode = $('#room-passcode-setting').val();

        if (passcode && passcode.length >= 6)
        {
            $('#passcode').val(passcode);

            var roomId = $('#roomId').val();

            if (roomId && passcode)
            {
                updateStatus(`Connecting to room ${roomId}...`);

                connect(roomId, passcode);
            }
            else
            {
                errorAlert('Error: Invalid room ID or passcode.');

            }
        }
        else
        {
            errorAlert('Please provide a passcode that is more than 6 characters.');
        }
    });
});

$('.alert .close').on('click', function(e) 
{
    $(this).parent().hide();
});

function successAlert(msg)
{
    $('#alert-success-txt').text(msg);
    $('#alert-success').show();
    $("#alert-success").fadeTo(2000, 500).slideUp(500, function()
    {
        $("#alert-success").slideUp(500);
    });
}

function errorAlert(msg)
{
    $('#alert-error-txt').text(msg);
    $('#alert-error').show();
    $("#alert-error").fadeTo(2000, 500).slideUp(500, function()
    {
        $("#alert-error").slideUp(500);
    });
}

function generateKey()
{
    var key = CryptoJS.lib.WordArray.random(128 / 8).toString();

    $('#room-passcode-setting').val(key);
}

function generatePasscode()
{
    $('#room-passcode-setting').val(humanReadableIds.random());
}

function encrypt(text, key)
{
    var e_text = CryptoJS.AES.encrypt(text, key).toString();

    return e_text;
}

function decrypt(text, key)
{
    var d_text = CryptoJS.AES.decrypt(text, key).toString(CryptoJS.enc.Utf8);

    return d_text;
}

function updateStatus(msg)
{
    msg = `[${moment().local().format("MM/DD/YYYY h:mm:ss a")}]: ${msg}`;

    $('#status-list').prepend($('<li class="list-group-item">').text(msg));
}

function notify(msg)
{
    $.notify(msg,
        {
            style: 'grey'
        });
}

function connect(roomId, passcode)
{
    let key = ""; // store encryption key in memory
    let clientKey = null; // store DH key

    var editor = new Quill('#editor',
        {
            modules: {
                toolbar: '#toolbar'
            },
            theme: 'snow'
        });

    var socket = io(
        {
            query: '&roomId=' + roomId,
            reconnectionDelay: 10000,
        });

    let secret_key = null;
    socket.on('connect', function()
    {
        updateStatus(`You connected to the server.`);
    });

    socket.on('auth:exchange', function(data, ack)
    {
        var server_publickey = data.key;

        updateStatus(`Creating public key.`);

        // Generate keys for Elliptic Curve Diffie-Hellman key exchange
        clientKey = bCrypto.createECDH('secp521r1');
        clientKey.generateKeys('hex');
        var client_publickey = clientKey.getPublicKey('hex');

        secret_key = clientKey.computeSecret(server_publickey, 'hex', 'hex');

        //console.log('auth:exchange secret_key: ' + secret_key);

        updateStatus(`Sending public key.`);

        ack(
            {
                'key': client_publickey
            });
    });

    socket.on('room:auth', function(data, ack)
    {
        updateStatus(`Initiating room authentication.`);

        // requested room passport
        ack({ 'passcode': passcode });
    });

    socket.on('authenticated', function(data) 
    {
        var encrypted_key = data.key;
        var encrypted_passcode = data.passcode;
        var username = data.username;
        var roomId = data.roomId;

        updateStatus(`Finishing key exchange.`);

        if (!secret_key)
        {
            updateStatus(`Key exchange failed. Secret is not defined.`);

            return;
        }

        var passcode = decrypt(encrypted_passcode, secret_key);
        key = decrypt(encrypted_key, secret_key);

        if (!key)
        {
            updateStatus(`Key exchange failed. Failed to decrypt key.`);

            return;
        }

        updateStatus(`Key exchange complete.`);
        updateStatus(`You are now authenticated in room ${data.roomId}.`);

        $('#room-id-info').val(roomId);
        $('#room-passcode-info').val(passcode);
        $('#room-username-info').val(username);

        $('title').text(`${username}@${roomId} - syncpad editor`);

        // If modal is shown, toggle it to hide it.
        // This fixes an issue where on reconnect, it shows the modal
        if ($('#settings-modal').data()['bs.modal'].isShown)
            $('#settings-modal').modal('toggle');
    });

    socket.on('unauthorized', function(data) 
    {
        var msg = data.message;
        var roomId = data.roomId;

        updateStatus(`You are not authorized in room ${data.roomId}: ${msg}`);
        errorAlert(`You are not authorized in room ${data.roomId}: ${msg}`);
    });

    socket.on('connect_error', function(err)
    {
        updateStatus(`connect_error: ${err.error}`);
        errorAlert(`connect_error: ${err.error}`);
    });

    socket.on('connect_timeout', function(err)
    {
        updateStatus(`connect_timeout: ${err.error}`);
        errorAlert(`connect_timeout: ${err.error}`);
    });

    socket.on('error', function(err)
    {
        updateStatus(`Error: ${err.error}`);
        errorAlert(`Error: ${err.error}`);
    });

    socket.on('disconnect', function(err)
    {
        updateStatus(`Disconnected from server.`);
    });

    socket.on('room:join', function(data)
    {
        updateStatus(`User ${data.user} joined the room.`);
        notify(`User ${data.user} joined the room.`);
    });

    socket.on('room:leave', function(data)
    {
        updateStatus(`User ${data.user} left the room from.`);
        notify(`User ${data.user} left the room.`);
    });

    // Received request to get latest text body
    socket.on('text:latest', function(data)
    {
        var m_user = data.user;
        var m_socketId = data.id;

        var text = editor.getContents();

        var data = JSON.stringify(text);
        var e_text = encrypt(data, key);

        console.log('text:latest: ' + data);

        socket.emit('text:refresh', { 'id': m_socketId, 'text': e_text });
    });

    socket.on('text', function(data)
    {
        var m_user = data.user;
        var m_text = data.text;

        var d_text = decrypt(m_text, key);
        var data = JSON.parse(d_text);

        console.log("text => " + JSON.stringify(data));

        editor.updateContents(data, "silent");
    });

    socket.on('text:typing', function(data)
    {

    });

    socket.once('text:refresh', function(data)
    {
        var m_text = data.text;

        var d_text = decrypt(m_text, key);

        if (d_text)
        {
            var data = JSON.parse(d_text);

            console.log('text:refresh: ' + d_text);

            editor.setContents(data, "silent");
        }
        else
        {
            updateStatus("Editor refresh failed.")
        }
    });

    socket.on('chat:msg', function(data)
    {
        var username = data.user;
        var msg = data.message;

        // decrypt
        var text = decrypt(msg, key);

        appendChat(username, text);

        if (username != $('#room-username-info').val())
            notify(`Message from ${username}.`);
    });

    editor.on('text-change', function(delta, oldDelta, source) 
    {
        if (source == 'user')
        {
            // Send editor delta of change instead
            var text = delta;

            var data = JSON.stringify(text);
            var e_data = encrypt(data, key);

            socket.emit('text', { 'text': e_data })
        }
    });

    editor.on('selection-change', function(range, oldRange, source)
    {
        if (range)
        {
            socket.emit('text:typing');
        }
    });

    $('#users-button').click(function()
    {
        socket.emit('users:list', null, function(clients)
        {
            $('#user-table tbody').empty();

            $.each(clients, function(id)
            {
                var client = clients[id];

                $('#user-table tbody').append(`
                    <tr>
                        <td>${client.username}</td>
                        <td>${moment(client.connectedTime).local().fromNow()}</td>
                        <td>${moment(client.lastUpdateTime).local().fromNow()}</td>
                    </tr>
                    `);
            });

            $('#users-modal').modal('toggle');
        });
    });

    //
    // Chat

    // Change username
    $('#room-username-change').click(function()
    {
        var username = $('#room-username-info').val();

        if (username)
        {
            socket.emit('chat:name change',
                { 'username': username },
                function(err, data)
                {
                    if (err)
                    {
                        console.log("username already exists in room.");

                        // Reset modal value
                        $('#room-username-info').val(data.username);
                    }
                    else
                    {
                        $('#room-username-info').val(data.username);

                        $('title').text(`${data.username}@${roomId} - syncpad editor`);

                    }

                });
        }
    });

    $('#chat-panel-send').click(function()
    {
        sendMessage();
    });

    $('#chat-panel-msg').on("keydown", function(event)
    {
        if (event.which == 13)
        {
            sendMessage();
        }
    });

    function sendMessage()
    {
        var msg = $('#chat-panel-msg').val();

        if (!msg)
            return;

        var encrypted_msg = encrypt(msg, key);

        socket.emit('chat:msg', { 'message': encrypted_msg });

        $('#chat-panel-msg').val("");
    }

    function appendChat(username, msg)
    {
        msg = sanitizeHtml(msg);

        var text =
            `<p class="list-group-item-heading"><p style="font-size: 15px; color: #1ac6ff">${username}</p></p>
                <p class="list-group-item-text" style="text-align: left; ">${msg} <span style="float: right; font-size: 9px; color: #B0B0B0">${moment().local().format("h:mm:ss a")}</span></p>`;

        $('#chat-panel-messages').append($('<li class="list-group-item">').html(text));

        $("#chat-panel-body").scrollTop($("#chat-panel-body")[0].scrollHeight);
    }
}