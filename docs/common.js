function getBrowser() {
    var ua = window.navigator.userAgent;
    var isIE = window.ActiveXObject != undefined && ua.indexOf("MSIE") != -1;
    var isFirefox = ua.indexOf("Firefox") != -1;
    var isOpera = window.opr != undefined;
    var isChrome = ua.indexOf("Chrome") && window.chrome;
    var isSafari = ua.indexOf("Safari") != -1 && ua.indexOf("Version") != -1;
    if (isIE) {
        return "IE";
    } else if (isFirefox) {
        return "Firefox";
    } else if (isOpera) {
        return "Opera";
    } else if (isChrome) {
        return "Chrome";
    } else if (isSafari) {
        return "Safari";
    } else {
        return "Unkown";
    }
}


function IsPC() {
    var userAgentInfo = navigator.userAgent;
    var Agents = new Array("Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod");
    var flag = true;
    for (var v = 0; v < Agents.length; v++) {
        if (userAgentInfo.indexOf(Agents[v]) > 0) {
            flag = false;
            break;
        }
    }
    return flag;
}

function enumDevices() {
    var audioInputList = [], videoInputList = [];
    zg.enumDevices(deviceInfo => {
        console.log('enumDevices' + JSON.stringify(deviceInfo));
        if (deviceInfo.microphones) {
            for (var i = 0; i < deviceInfo.microphones.length; i++) {

                if (!deviceInfo.microphones[i].label) {
                    deviceInfo.microphones[i].label = 'microphone' + i;
                }
                audioInputList.push(' <option value="' + deviceInfo.microphones[i].deviceId + '">' + deviceInfo.microphones[i].label + '</option>');
                console.log("microphone: " + deviceInfo.microphones[i].label);
            }
        }

        if (deviceInfo.cameras) {
            for (var i = 0; i < deviceInfo.cameras.length; i++) {
                if (!deviceInfo.cameras[i].label) {
                    deviceInfo.cameras[i].label = 'camera' + i;
                }
                videoInputList.push('<option value="' + deviceInfo.cameras[i].deviceId + '">' + deviceInfo.cameras[i].label + '</option>');
                console.log("camera: " + deviceInfo.cameras[i].label);
            }
        }

        audioInputList.push(' <option value="0">禁止</option>');
        videoInputList.push('<option value="0">禁止</option>');

        $('#audioList').html(audioInputList.join(''));
        $('#videoList').html(videoInputList.join(''));
    }, function (error) {
        console.error("enum device error: " + error);
    });
}


function openRoom(roomId, type) {

    if (!roomId) {
        alert('请输入房间号');
        return;
    }

    screenCaptrue && zg.stopScreenShot();

    //get token
    $.get("https://wsliveroom229059616-api.zego.im:8282/token", {app_id: _config.appid, id_name: _config.idName},
        function (token) {
            if (!token) {
                alert('get token failed')
            } else {
                console.log('gettoken success');
                startLogin(roomId, token, type)
            }
        }, 'text');
}


//login
function startLogin(roomId, token, type) {
    zg.login(roomId, type, token, function (streamList) {
        console.log('login success');
        loginSuccess(streamList, type);
    }, function (err) {
        loginFailed(err);
    })
}

function loginFailed(err) {
    alert('登录失败');
    console.error(err)

}

function loginSuccess(streamList, type) {
    var maxNumber = ($('#maxPullNamber') && $('#maxPullNamber').val()) || 4

    //限制房间最多人数，原因：视频软解码消耗cpu，浏览器之间能支撑的个数会有差异，太多会卡顿
    if (streamList.length >= maxNumber) {
        alert('房间太拥挤，换一个吧！');
        leaveRoom();
        return;
    }

    useLocalStreamList = streamList;

    $('.remoteVideo').html('');
    $('#memberList').html('');
    for (var index = 0; index < useLocalStreamList.length; index++) {
        $('.remoteVideo').append($('<video  autoplay muted playsinline></video>'));
        $('#memberList').append('<option value="' + useLocalStreamList[index].anchor_id_name + '">' + useLocalStreamList[index].anchor_nick_name + '</option>');
        play(useLocalStreamList[index].stream_id, $('.remoteVideo video:eq(' + index + ')')[0]);
    }
    console.log(`login success`);

    loginRoom = true;

    // 监听sdk回掉
    listen();

    //开始预览本地视频
    type === 1 && doPreviewPublish();

}

//预览
function doPreviewPublish(config) {
    var quality = ($('#videoQuality') && $('#videoQuality').val()) || 2;

    var previewConfig = {
        "audio": $('#audioList').val() === '0' ? false : true,
        "audioInput": $('#audioList').val() || null,
        "video": $('#videoList').val() === '0' ? false : true,
        "videoInput": $('#videoList').val() || null,
        "videoQuality": quality * 1,
        "horizontal": true,
        "externalCapture": false,
        "externalMediaStream": null
    };
    previewConfig = $.extend(previewConfig, config);
    console.log('previewConfig', previewConfig);
    var result = zg.startPreview(previewVideo, previewConfig, function () {
        console.log('preview success');
        isPreviewed = true;
        $('#previewLabel').html(_config.nickName);
        publish();
        //部分浏览器会有初次调用摄像头后才能拿到音频和视频设备label的情况，
        enumDevices();
    }, function (err) {
        alert(JSON.stringify(err));
        console.error('preview failed', err);
    });

    if (!result) alert('预览失败！')
}

//推流
function publish() {
    zg.startPublishingStream(_config.idName, previewVideo);
}

function play(streamId, video) {
    var result = zg.startPlayingStream(streamId, video);

    video.muted = false;
    if (!result) {
        alert('哎呀，播放失败啦');
        video.style = 'display:none';
        console.error("play " + el.nativeElement.id + " return " + result);

    }
}


function listen() {
    var _config = {
        onPlayStateUpdate: function (type, streamid, error) {
            if (type == 0) {
                console.info('play  success');
            }
            else if (type == 2) {
                console.info('play retry');
            } else {

                console.error("play error " + error.msg);

                var _msg = error.msg;
                if (error.msg.indexOf('server session closed, reason: ') > -1) {
                    var code = error.msg.replace('server session closed, reason: ', '');
                    if (code == 21) {
                        _msg = '音频编解码不支持(opus)';
                    } else if (code == 22) {
                        _msg = '视频编解码不支持(H264)'
                    } else if (code == 20) {
                        _msg = 'sdp 解释错误';
                    }
                }
                alert('拉流失败,reason = ' + _msg);
            }

        },
        onPublishStateUpdate: function (type, streamid, error) {
            if (type == 0) {
                console.info(' publish  success');
            } else if (type == 2) {
                console.info(' publish  retry');
            } else {
                console.error('publish error ' + error.msg);
                var _msg = error.msg;
                if (error.msg.indexOf('server session closed, reason: ') > -1) {
                    var code = error.msg.replace('server session closed, reason: ', '');
                    if (code == 21) {
                        _msg = '音频编解码不支持(opus)';
                    } else if (code == 22) {
                        _msg = '视频编解码不支持(H264)'
                    } else if (code == 20) {
                        _msg = 'sdp 解释错误';
                    }
                }
                alert('推流失败,reason = ' + _msg);

            }

        },
        onPublishQualityUpdate: function (streamid, quality) {
            console.info("#" + streamid + "#" + "publish " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
        },

        onPlayQualityUpdate: function (streamid, quality) {
            console.info("#" + streamid + "#" + "play " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
        },

        onDisconnect: function (error) {
            console.error("onDisconnect " + JSON.stringify(error));
            alert('网络连接已断开' + JSON.stringify(error));
            leaveRoom();
        },

        onKickOut: function (error) {
            console.error("onKickOut " + JSON.stringify(error));
        },
        onStreamUpdated: function (type, streamList) {
            if (type == 0) {
                for (var i = 0; i < streamList.length; i++) {
                    console.info(streamList[i].stream_id + ' was added');
                    useLocalStreamList.push(streamList[i]);
                    $('#memberList').append('<option value="' + streamList[i].anchor_id_name + '">' + streamList[i].anchor_nick_name + '</option>');
                    $('.remoteVideo').append($('<video  autoplay muted playsinline></video>'));
                    play(streamList[i].stream_id, $('.remoteVideo video:last-child')[0]);
                }

            } else if (type == 1) {

                for (var k = 0; k < useLocalStreamList.length; k++) {

                    for (var j = 0; j < streamList.length; j++) {

                        if (useLocalStreamList[k].stream_id === streamList[j].stream_id) {

                            zg.stopPlayingStream(useLocalStreamList[k].stream_id);

                            console.info(useLocalStreamList[k].stream_id + 'was devared');

                            useLocalStreamList.splice(k, 1);

                            $('.remoteVideo video:eq(' + k + ')').remove();
                            $('#memberList option:eq(' + k + ')').remove();

                            break;
                        }
                    }
                }
            }

        }
    };

    for (var key in _config) {
        zg[key] = _config[key]
    }

    if (typeof listenChild === 'function') {
        listenChild();
    }

}


function leaveRoom() {
    console.info('leave room  and close stream');

    if(isPreviewed){
        zg.stopPreview(previewVideo);
        zg.stopPublishingStream(_config.idName);
        isPreviewed = false;
    }

    for (var i = 0; i < useLocalStreamList.length; i++) {
        zg.stopPlayingStream(useLocalStreamList[i].stream_id);
    }

    useLocalStreamList = [];
    $('.remoteVideo').html('');
    zg.logout();
}


var zg,
    _config = {
        "appid": 229059616,
        "idName": new Date().getTime() + '',
        "nickName": 'u' + new Date().getTime(),
        "server": "wss://wsliveroom229059616-api.zego.im:8282/ws",
        "logLevel": 0,
        "logUrl": "",
        "remoteLogLevel": 0,
        "audienceCreateRoom": true
    },
    loginRoom = false,
    previewVideo,
    screenCaptrue,
    isPreviewed = false,
    useLocalStreamList = [];
var anchor_userid = '', anchro_username = '';

function init() {

    zg = new ZegoClient();

    console.log("config param:" + JSON.stringify(_config));

    zg.config(_config);


    enumDevices();
}


function bindEvent() {
    previewVideo = $('#previewVideo')[0];

    //初始化sdk
    init();

    $('#createRoom').click(function () {
        openRoom($('#roomId').val(), 1);
    });

    $('#openRoom').click(function () {
        openRoom($('#roomId').val(), 2);
    });


    $('#leaveRoom').click(function () {
        leaveRoom();
    });


    //防止，暴力退出（关闭或刷新页面）
    var isOnIOS = navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i);
    var eventName = isOnIOS ? "pagehide" : "beforeunload";
    window.addEventListener(eventName, function (event) {
        window.event.cancelBubble = true; // Don't know if this works on iOS but it might!
        leaveRoom();
    });

}

$(function () {
    if (ZegoClient.isSupportWebrtc()) {
        ZegoClient.isSupportH264(result => {
            bindEvent();
            if (!result) {
                alert('浏览器不支持视频h264编码，不能推拉音频流');
            }
        }, err => {
            console.error(err);
        })
    } else {
        alert('浏览器不支持webrtc，换一个浏览器试试吧');
    }


});
