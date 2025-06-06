//"use strict"; //so it turns out there's a reason we didn't do this before D:

//abort if multiplayer has already been set up

// !!! Add multiplayer setup

const multiplayer = {
    code: "",
    roomUsers: [],
    beatmap: 0,
    readyTime: Infinity,
    buttonHover: [0],
    isHost: false,
    ready: false,
    mapId: 10436,
    selLevel: 10436,
    loadingMaps: [],
    modsNSM: {
        host: null,
        player: null,
    },
    selMods: {
        bpm: 1,
        hw: 1,
    },
    startTime: 0,
};

//Calculates a player's ScoreV2 score from their hitstats
function scoreV2(stats, totalNoteCount) {
    let [marvs, greats, goods, oks, misses] = stats;

    curNoteCount = marvs + greats + goods + oks + misses;

    accScore =
        ((marvs + greats * 0.975 + goods * 0.5 + oks * 0.1) / curNoteCount) **
        3;
    inputScore =
        (1 - (misses + 0.25 * (oks + goods)) / curNoteCount) ** (0.5 * misses);

    return floor(
        ((750000 * accScore + 250000 * inputScore) * curNoteCount) /
            totalNoteCount
    );
}

// !!! Server Stuffs
//instantiate iframe link to server
const RequestTypes = Object.freeze({
    POST: "POST",
    GET: "GET",
    LOCALSET: "LOCALSET",
});
const ServerParams = Object.freeze({
    METHOD: "method",

    UUID: "uuid",

    READY: "ready",

    SCORE: "score",
    COMBO: "combo",

    LOBBY_NAME: "lobbyName",

    MAP_ID: "mapId",
    BPM_MOD: "bpmMod",
    HW_MOD: "hwMod",
});
const Methods = Object.freeze({
    SET_SCOREBOARD: "setScoreboard",
    SET_MAP_DATA: "setMapData",
    SET_LOBBY: "setLobby",
    SET_START_TIME: "setStartTime",
    SET_READY: "setReady",
    LOG_OFF: "logoff",

    GET_SCOREBOARD: "getScoreboard",
    GET_LOBBY_DATA: "getLobbyData",
});

const SERVER_FRAME = document.createElement("iframe");
SERVER_FRAME.src = "https://172.104.10.6/Server.html";
document.children[0].appendChild(SERVER_FRAME);
class Server {
    //server calling helper methods
    static request(method, data) {
        let message = method + " ";
        for (const entry of Object.entries(data)) {
            if (entry[1]) {
                message += entry.join("=") + "&";
            }
        }
        message = message.slice(0, -1); //remove the trailing &

        console.log(message);

        SERVER_FRAME.contentWindow.postMessage(message, "*");
    }

    static setterParams(method) {
        const data = {};
        data[ServerParams.METHOD] = method;
        data[ServerParams.UUID] = T.uuid;
        return data;
    }
    static getterParams(method) {
        const data = {};
        data[ServerParams.METHOD] = method;
        data[ServerParams.LOBBY_NAME] = multiplayer.code;
        return data;
    }

    static setScoreboard(score = null, combo = null) {
        console.log("setting scoreboard");
        const data = this.setterParams(Methods.SET_SCOREBOARD);
        data[ServerParams.SCORE] = score;
        data[ServerParams.COMBO] = combo;

        this.request(RequestTypes.POST, data);
    }
    static setMapData(mapId = null, bpmMod = null, hwMod = null) {
        console.log("Setting map data");
        const data = this.setterParams(Methods.SET_MAP_DATA);
        data[ServerParams.MAP_ID] = mapId;
        data[ServerParams.BPM_MOD] = bpmMod;
        data[ServerParams.HW_MOD] = hwMod;

        this.request(RequestTypes.POST, data);
    }
    static setLobby(lobbyName) {
        console.log("setting lobby");
        const data = this.setterParams(Methods.SET_LOBBY);
        data[ServerParams.LOBBY_NAME] = lobbyName;

        this.request(RequestTypes.POST, data);
    }
    static setStartTime() {
        console.log("setting start time");
        this.request(
            RequestTypes.POST,
            this.setterParams(Methods.SET_START_TIME)
        );
    }
    static setReady(ready) {
        console.log("setting ready");
        const data = this.setterParams(Methods.SET_READY);
        data[ServerParams.READY] = ready;
        this.request(RequestTypes.POST, data);
    }
    static logOff() {
        console.log("logging off");
        this.request(RequestTypes.POST, this.setterParams(Methods.LOG_OFF));
    }

    static getScoreboard() {
        console.log("getting scoreboard");
        this.request(
            RequestTypes.GET,
            this.getterParams(Methods.GET_SCOREBOARD)
        );
    }
    static getLobbyData() {
        console.log("getting lobby data");
        this.request(
            RequestTypes.GET,
            this.getterParams(Methods.GET_LOBBY_DATA)
        );
    }

    static localSet(key, value) {
        const messageArray = [RequestTypes.LOCALSET, key, value];
        const message = messageArray.join(" ");
        SERVER_FRAME.contentWindow.postMessage(message, "*");
    }
}

function setReady(ready) {
    multiplayer.ready = ready;
    multiplayer.roomUsers[T.uuid].ready = multiplayer.ready;
    Server.setReady(multiplayer.ready);
}

let mapStarting = false;

let serverPollingInterval = setInterval(() => {
    if (multiplayer.code != "" && SERVER_FRAME.contentWindow) {
        if (He === "game") {
            if (Tt.disMode === 1) {
                Server.setScoreboard(
                    scoreV2(Tt.hitStats, Tt.beat.length),
                    Tt.combo ?? 0
                );
            }
            Server.getScoreboard();
        } else if (Bt.screen == "multiplayer") {
            Server.getLobbyData();

            if (!mapStarting && multiplayer.startTime > Date.now()) {
                mapStarting = true;

                Bt.screen = "lvl";
                setReady(false);
                Tt.edit = false;
                Tt.replay.on = false;
                Ht.search = [multiplayer.mapId];
                Bt.lvl.sel = 0;
                qi(0);
                Tt.paused = true;

                setTimeout(() => {
                    Mn("retry");
                    mapStarting = false;
                    //Tt.paused = false
                }, multiplayer.startTime - Date.now());
            }
        }
    }
}, 1000);

// Logoff if user leaves site without hitting the x
// The server iframe actually logs you out itself (on the "unload" event instead of "beforeunload"), but it needs a UUID
window.addEventListener("beforeunload", function (event) {
    console.log("Window unloading...sending uuid to the server");
    Server.localSet(ServerParams.uuid, T.uuid);
    console.log("Sent");
});

let serverResponseListener = window.addEventListener(
    "message",
    function (event) {
        if ((event.data.type ?? "nop") == "rpc") {
            return;
        }

        //console.log(event.data);

        const multiData = JSON.parse(event.data.replaceAll("'", '"'));

        if (multiData.method == "getScoreboard") {
            for (const [uuid, data] of Object.entries(multiData.scores)) {
                if (uuid in multiplayer.roomUsers) {
                    multiplayer.roomUsers[uuid].score = Number(data.score);
                    multiplayer.roomUsers[uuid].combo = Number(data.combo);
                } else {
                    multiplayer.roomUsers[uuid] = new MultiUser(uuid);
                }
            }
        } else if (multiData.method == "getLobbyData") {
            multiplayer.startTime = multiData.startTime;

            for (const [uuid, data] of Object.entries(multiData.players)) {
                if (uuid in multiplayer.roomUsers) {
                    multiplayer.roomUsers[uuid].host = (uuid == multiData.host);
                    if(multiplayer.roomUsers[uuid].score !== 0 || multiplayer.roomUsers[uuid].combo !== 0) {
                        multiplayer.roomUsers[uuid].score = 0;
                        multiplayer.roomUsers[uuid].combo = 0;
                    }
                    if (uuid != T.uuid) {
                        multiplayer.roomUsers[uuid].ready = data.ready;
                    }
                } else {
                    multiplayer.roomUsers[uuid] = new MultiUser(uuid);
                }
            }

            let i = 0;
            const uuids = Object.keys(multiplayer.roomUsers);
            while (i < uuids.length) {
                if (uuids[i] in multiData.players) {
                    i++;
                } else {
                    delete multiplayer.roomUsers[uuids[i]];
                    uuids.splice(i, 1);
                }
            }
            multiplayer.isHost = T.uuid == multiData.host;

            if (!multiplayer.isHost) {
                Bt.lvl.search = "Wait For Host!";

                const newMapId = Number(multiData.mapId);
                const newBpm = Number(multiData.mods.bpmMod);
                const newHw = Number(multiData.mods.hwMod);

                if (multiplayer.mapId !== newMapId) {
                    console.log("map changed");
                    multiplayer.mapId = newMapId;
                    Rt[0] = multiplayer.mapId;
                    setReady(false);
                }
                if (multiplayer.selMods.bpm !== newBpm || multiplayer.selMods.hw !== newHw) {
                    Tt.mods.bpm = Number(multiData.mods.bpmMod);
                    Tt.mods.hitWindow = Number(multiData.mods.hwMod);
                    multiplayer.selMods.bpm = Tt.mods.bpm;
                    multiplayer.selMods.hw = Tt.mods.hitWindow;
                    setReady(false);
                }
            }
        }

        //gets user data
        // for (const [uuid, data] of Object.entries(multiData[multiplayer.code].players)) {
        //     added = false
        //     for (curUser of multiplayer.roomUsers) {
        //         if (curUser.uuid && curUser.uuid == uuid) {
        //             added = true
        //             curUser.score = Number(data.score)
        //             curUser.combo = Number(data.combo)
        //             curUser.host = Boolean(data.host)
        //             if (curUser.uuid != T.uuid) {
        //                 curUser.ready = Boolean(data.ready)
        //             }
        //         }
        //     }
        //     if (!added) {
        //         multiplayer.roomUsers.push(new MultiUser(uuid))
        //     }
        // }

        // for (let curUser of multiplayer.roomUsers) {
        //     if (curUser.uuid == T.uuid) {
        //         multiplayer.isHost = multiData[multiplayer.code].players[T.uuid].host

        //         if (!multiplayer.isHost) {
        //             Tt.mods.bpm = Number(multiData[multiplayer.code].mods.bpmMod)
        //             Tt.mods.hitWindow = Number(multiData[multiplayer.code].mods.hwMod)
        //             multiplayer.mapId = Number(multiData[multiplayer.code].mapId)
        //         }
        //         multiplayer.selMods.bpm = Tt.mods.bpm,
        //         multiplayer.selMods.hw = Tt.mods.hitWindow
        //     }
        // }

        // if (!multiplayer.isHost) {

        //     if (Bt.screen == "lvl" && He == "menu") {
        //         if (!v.newGrabbedLevels[multiplayer.mapId]) {
        //             B("newGrabLevelMeta", {
        //                 mode: "id",
        //                 a: multiplayer.mapId
        //             })
        //         }
        //         while (Rt.length > 1) { Rt.pop(0) }
        //         Bt.lvl.search = "Wait For Host!"
        //         Rt[0] = multiplayer.mapId
        //     }
        // }
    }
);

// !!! Creates class to show multiplayer user data

class MultiUser {
    constructor(uuid) {
        if (v.newGrabbedUsers.uuid) {
            B("newGrabUser", {
                mode: "uuid",
                a: uuid,
            });
        }
        let loadCheck = setInterval(() => {
            if (Ut(uuid, "uuid").user != "Loading...") {
                clearInterval(loadCheck);
                (this.username = Ut(uuid, "uuid").user),
                    (this.pfp = loadImage(Ut(uuid, "uuid").pp));
                this.rank = Ut(uuid, "uuid").rank;
            }
        }, 500);
        this.uuid = uuid;
        this.username = "Loading...";
        (this.pfp = St.logo),
            (this.score = Math.floor(Math.random() * 1000000)),
            (this.combo = Math.floor(Math.random() * 500)),
            (this.ready = false);
        this.host = false;
    }

    draw(xval, yval, wval) {
        push(), (this.padding = width / 250);
        this.move_pad = wval / 4 - kt / 8;
        smooth(), rectMode(CORNER), strokeWeight(kt / 8);
        if (Ut(T.uuid, "uuid").user == this.username) {
            stroke("rgba(255, 255, 0, 0.5)");
            fill("rgba(127, 127, 0, 0.1)");
        } else {
            stroke("rgba(0, 175, 255, 0.5)");
            fill("rgba(0, 87, 127, 0.1)");
        }
        rect(xval, yval, wval, wval / 4),
            fill(255),
            noStroke(),
            textSize(kt / 1.25),
            // Username
            textAlign(LEFT, TOP),
            text(
                this.username,
                xval + this.padding + this.move_pad,
                yval + this.padding
            ),
            // Score
            textAlign(LEFT, BOTTOM),
            text(
                this.score,
                xval + this.padding + this.move_pad,
                yval + wval / 4 - this.padding
            ),
            // Combo
            textAlign(RIGHT, BOTTOM),
            text(
                this.combo + "x",
                xval + wval - this.padding,
                yval + wval / 4 - this.padding
            ),
            imageMode(CORNER),
            image(
                this.pfp,
                xval + kt / 16,
                yval + kt / 16,
                this.move_pad,
                this.move_pad
            ),
            pop();
    }

    drawLobby(xval, yval, wval) {
        push(), (this.padding = width / 200);
        smooth(), rectMode(CORNER), strokeWeight(kt / 8);
        if (this.host) {
            stroke("rgba(150, 150, 0, 0.5)");
            fill("rgba(75, 75, 0, 0.1)");
        } else if (this.ready) {
            stroke("rgba(0, 150, 0, 0.5)");
            fill("rgba(0, 75, 0, 0.1)");
        } else {
            stroke("rgba(150, 150, 150, 0.5)");
            fill("rgba(75, 75, 75, 0.1)");
        }
        rect(xval, yval, wval, wval / 10),
            fill(255),
            noStroke(),
            textSize(kt * 1.25),
            // Username
            textAlign(LEFT, TOP),
            text(this.username, xval + this.padding, yval + wval / 40),
            // Rank
            textAlign(RIGHT, TOP),
            text("#" + this.rank, xval - this.padding + wval, yval + wval / 40),
            pop();
    }
}

// Look at function c()

// "ea3e14df-bacc-431a-a353-312cb824c662"
// Tt.bg = v.newGrabbedUsers[ea3e14df-bacc-431a-a353-312cb824c662].pp

function compareScore(a, b) {
    return b.score - a.score;
}

function compareRank(a, b) {
    return a.rank - b.rank;
}

// v.newGLRequested[Rt[menu.lvl.sel]] = true
// m(Rt[menu.lvl.sel], "id", true);

multiplayer.roomUsers = {
    // new MultiUser("dd48a6a6-e59c-46e6-96ca-f1e0f478154e"), // _t(Ut(T.uuid, "uuid").pp)
    // // new MultiUser("41ca407f-0732-4fa7-b62b-0bff8a20b07d"), //shia
    // new MultiUser("ce2cee3b-c9fe-45ac-aba8-07d28fb8dd99"),
    // // new MultiUser("05d4ce4f-a3c1-4632-a792-6381ecece78e") //tetro (my game also shat itself after switching to him)
};
F.en["settings_multiCode"] = "Multiplayer Room";
F.en["settings_multiCode_sub"] = "Connect with other users using the same code";
F.en["settings_multiConnect"] = "Refresh Connection";
F.en["settings_multiConnect_sub"] =
    "Connect to the given room, or leave the code blank to play solo";
F.en["settings_multiConnect_refresh"] =
    "You are connected to `1`!\nConnected players (`2`):\n`3`";
F.en["settings_multiConnect_single"] =
    "You have disconnected from multiplayer!";
F.en["multiplayer_menu_connected_users"] = "(Connected: `1`)";
F.en["multiplayer_menu_play_spec"] = "Spectate";
F.en["multiplayer_menu_play_rejoin"] = "Rejoin";
F.en["multiplayer_menu_select"] = "Select Map";
F.en["menu_multiplayer_title"] = "Multiplayer";
F.en["menu_multiplayer_ready"] = "Ready";
F.en["menu_multiplayer_unready"] = "Unready";
F.en["multiplayer_modsDesc"] = "`1`x BPM, `2`x HW";
F.en["multiplayer_selectError"] = "You cannot play multiplayer on a local map!";
F.en["multiplayer_editError"] =
    "You cannot open the editor while in multiplayer!";
F.en["multiplayer_playError"] =
    "You cannot play a local map while in multiplayer!";
F.en["multiplayer_readyError"] = "Please wait for all players to ready first!";
F.en["multiplayer_waiting"] = "Waiting for players...";

// Bt.settings.menu.pages[4].items.push({
//     type: "string",
//     var: [Bt.settings, "multiCode"],
//     name: "settings_multiCode",
//     hint: "settings_multiCode_sub",
//     allowEmpty: !0
// })

// Bt.settings.menu.pages[4].items.push({
//     type: "button",
//     name: "settings_multiConnect",
//     hint: "settings_multiConnect_sub",
//     event: () => {
//         multiplayer.code = Bt.settings.multiCode
//         // Wait for connection, then send this
//         if (multiplayer.code == '') {
//             Gn({
//                 type: "success",
//                 message: "settings_multiConnect_single",
//                 keys: []
//             });
//         } else {
//             multiplayer.roomUsers = []
//             SERVER_FRAME.contentWindow.postMessage(`POST method=setMapData&uuid=${T.uuid}&lobbyName=${multiplayer.code}&bpmMod=${Tt.mods.bpm}&hwMod=${Tt.mods.hw}`, "*")
//             Gn({
//                 type: "success",
//                 message: "settings_multiConnect_refresh",
//                 keys: [multiplayer.code, multiplayer.roomUsers.length, multiplayer.roomUsers.map(user => user.username).join(', ')]
//             });
//         }
//     }
// })

// !!! Navigation page
Bt.nav.push(["menu_multiplayer_title", "multiplayer", "account"]);

// Mod menu for host
multiplayer.modsNSM.host = new Jo([
    {
        title: "menu_lvl_mods",
        items: [
            {
                type: "slider",
                name: "mods_bpm",
                var: [Tt.mods, "bpm"],
                min: 0.5,
                max: 2,
                step: 0.01,
                hint: "mods_bpm_sub",
                display: function () {
                    return Tt.mods.bpm + "x";
                },
            },
            {
                type: "slider",
                name: "mods_foresight",
                var: [Tt.mods, "foresight"],
                min: 0.25,
                max: 2,
                step: 0.01,
                flip: !0,
                hint: "mods_foresight_sub",
                display: function () {
                    return Tt.mods.foresight + "x";
                },
            },
            {
                type: "slider",
                name: "mods_hitWindow",
                var: [Tt.mods, "hitWindow"],
                min: 0.25,
                max: 2,
                step: 0.01,
                flip: !0,
                hint: "mods_hitWindow_sub",
                display: function () {
                    return Tt.mods.hitWindow + "x";
                },
            },
            {
                type: "boolean",
                name: "mods_hidden",
                hint: "mods_hidden_sub",
                var: [Tt.mods, "hidden"],
            },
            {
                type: "boolean",
                name: "mods_noEffects",
                hint: "mods_noEffects_sub",
                var: [Tt.mods, "noEffects"],
            },
            {
                type: "boolean",
                name: "mods_mirror",
                hint: "mods_mirror_sub",
                var: [Tt.mods, "mirror"],
            },
            {
                type: "boolean",
                name: "mods_noRelease",
                hint: "mods_noRelease_sub",
                var: [Tt.mods, "noRelease"],
            },
            {
                type: "boolean",
                name: "mods_flashlight",
                hint: "mods_flashlight_sub",
                var: [Tt.mods, "flashlight"],
            },
            {
                type: "number",
                name: "mods_startPos",
                hint: "mods_startPos_sub",
                var: [Tt.mods, "startPos"],
                min: 0,
                max: !1,
                bigChange: 1e4,
                smallChange: 1e3,
            },
            {
                type: "number",
                name: "mods_endPos",
                hint: "mods_endPos_sub",
                var: [Tt.mods, "endPos"],
                min: 0,
                max: !1,
                bigChange: 1e4,
                smallChange: 1e3,
                display: () =>
                    0 === Tt.mods.endPos ? Pt("end", xt) : Tt.mods.endPos,
            },
            {
                type: "number",
                name: "mods_offset",
                hint: "mods_offset_sub",
                var: [Tt.mods, "offset"],
                min: !1,
                max: !1,
                bigChange: 10,
                smallChange: 1,
            },
        ],
    },
]);

// Mod menu for player
multiplayer.modsNSM.player = new Jo([
    {
        title: "menu_lvl_mods",
        items: [
            {
                type: "slider",
                name: "mods_foresight",
                var: [Tt.mods, "foresight"],
                min: 0.25,
                max: 2,
                step: 0.01,
                flip: !0,
                hint: "mods_foresight_sub",
                display: function () {
                    return Tt.mods.foresight + "x";
                },
            },
            {
                type: "boolean",
                name: "mods_hidden",
                hint: "mods_hidden_sub",
                var: [Tt.mods, "hidden"],
            },
            {
                type: "boolean",
                name: "mods_noEffects",
                hint: "mods_noEffects_sub",
                var: [Tt.mods, "noEffects"],
            },
            {
                type: "boolean",
                name: "mods_mirror",
                hint: "mods_mirror_sub",
                var: [Tt.mods, "mirror"],
            },
            {
                type: "boolean",
                name: "mods_noRelease",
                hint: "mods_noRelease_sub",
                var: [Tt.mods, "noRelease"],
            },
            {
                type: "boolean",
                name: "mods_flashlight",
                hint: "mods_flashlight_sub",
                var: [Tt.mods, "flashlight"],
            },
            {
                type: "number",
                name: "mods_offset",
                hint: "mods_offset_sub",
                var: [Tt.mods, "offset"],
                min: !1,
                max: !1,
                bigChange: 10,
                smallChange: 1,
            },
        ],
    },
]);

c.multiplayer = function () {
    push();

    if (multiplayer.code != "") {
        // Show Users
        fill($.overlayShade);
        rect(0, height / 16, width / 3, height);
        tempUserDraw = Object.values(multiplayer.roomUsers).sort(compareRank);
        tempUserDraw.forEach((user, index) => {
            user.drawLobby(
                width / 64,
                height / 2 -
                    (Object.keys(multiplayer.roomUsers).length * width) / 45 +
                    index * (width / 22.5) +
                    height / 16,
                width / 3 - width / 32
            );
        });
        fill(255),
            textAlign(CENTER, TOP),
            textSize(kt * 1.5),
            text(
                Pt(
                    "multiplayer_menu_connected_users",
                    xt,
                    Object.keys(multiplayer.roomUsers).length
                ),
                width / 6,
                height / 12
            );

        // Make sure level is downloaded
        if (!v.newGrabbedLevels[multiplayer.mapId]) {
            if (!multiplayer.loadingMaps.includes(multiplayer.mapId)) {
                B("newGrabLevelMeta", {
                    mode: "id",
                    a: multiplayer.mapId,
                });
                multiplayer.loadingMaps.push(multiplayer.mapId);
            }
        } else {
            // Inputs
            i = width > height ? width / 64 : height / 64;
            h = qo(multiplayer.mapId);
            Kt(
                width / 3 + i,
                height / 16 +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i,
                (width / 3) * 2 - 2 * i,
                ((height - height / 16) / 3 / 3) * 2 - i / 2,
                Pt(
                    0 === h
                        ? "menu_download"
                        : 2 === h
                        ? !multiplayer.isHost
                            ? multiplayer.ready
                                ? "menu_multiplayer_unready"
                                : "menu_multiplayer_ready"
                            : "menu_lvl_play"
                        : "menu_downloading",
                    xt
                ),
                Bt.lvl.buttonHover,
                4
            );
            multiplayer.isHost
                ? (Kt(
                      width / 3 + i,
                      height / 16 +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 / 3) * 2 +
                          i / 2,
                      ((width / 3) * 2 - 4 * i) / 3,
                      (height - height / 16) / 3 / 3 - i / 2,
                      Pt("multiplayer_menu_play_spec", xt),
                      Bt.lvl.buttonHover,
                      11
                  ),
                  Kt(
                      width / 3 + 2 * i + ((width / 3) * 2 - 4 * i) / 3,
                      height / 16 +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 / 3) * 2 +
                          i / 2,
                      ((width / 3) * 2 - 4 * i) / 3,
                      (height - height / 16) / 3 / 3 - i / 2,
                      Pt("menu_lvl_mods", xt),
                      Bt.lvl.buttonHover,
                      12
                  ),
                  Kt(
                      width / 3 + 3 * i + (((width / 3) * 2 - 4 * i) / 3) * 2,
                      height / 16 +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 / 3) * 2 +
                          i / 2,
                      ((width / 3) * 2 - 4 * i) / 3,
                      (height - height / 16) / 3 / 3 - i / 2,
                      Pt("multiplayer_menu_select", xt),
                      Bt.lvl.buttonHover,
                      3
                  ))
                : (Kt(
                      width / 3 + i,
                      height / 16 +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 / 3) * 2 +
                          i / 2,
                      ((width / 3) * 2 - 4 * i) / 2,
                      (height - height / 16) / 3 / 3 - i / 2,
                      Pt("multiplayer_menu_play_spec", xt),
                      Bt.lvl.buttonHover,
                      11
                  ),
                  Kt(
                      width / 3 + 3 * i + ((width / 3) * 2 - 4 * i) / 2,
                      height / 16 +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 - 2 * i) +
                          i +
                          ((height - height / 16) / 3 / 3) * 2 +
                          i / 2,
                      ((width / 3) * 2 - 4 * i) / 2,
                      (height - height / 16) / 3 / 3 - i / 2,
                      Pt("menu_lvl_mods", xt),
                      Bt.lvl.buttonHover,
                      12
                  ));

            // Show map metadata
            var i = width > height ? width / 64 : height / 64;
            fill(0, 25);
            rect(
                width / 3 + i,
                height / 16 + i,
                (((width / 3) * 2) / 3) * 2 - 2 * i,
                (height - height / 16) / 3 - 2 * i,
                i
            ),
                imageMode(CENTER),
                Po(
                    width / 3 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    height / 16 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    m(multiplayer.mapId, "id", true).stars,
                    m(multiplayer.mapId, "id", true).ranked,
                    m(multiplayer.mapId, "id", true).special
                ),
                fill($.text),
                textAlign(LEFT, CENTER),
                Dt(
                    H(multiplayer.mapId, "id").title,
                    width / 3 +
                        3 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i),
                    height / 16 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    (((width / 3) * 2) / 3) * 2 -
                        2 * i -
                        3 * i -
                        (((height - height / 16) / 3 - 2 * i) / 2 - i),
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    "bold"
                );
            var o = Ut(H(multiplayer.mapId, "id").author, "uuid").user;
            Dt(
                Pt(
                    "menu_lvl_by",
                    xt,
                    void 0 === o ? Pt("defaultUsername", xt) : o
                ),
                width / 3 + 2 * i,
                height / 16 + 2 * i + ((height - height / 16) / 3 - 2 * i) / 2,
                (((width / 3) * 2) / 3) * 2 - 2 * i - 2 * i,
                ((height - height / 16) / 3 - 2 * i) / 4 - i
            ),
                Dt(
                    Pt(
                        "menu_lvl_song",
                        xt,
                        Lt(H(multiplayer.mapId, "id").song, "id").artist,
                        Lt(H(multiplayer.mapId, "id").song, "id").name
                    ),
                    width / 3 + 2 * i,
                    height / 16 +
                        1.5 * i +
                        ((height - height / 16) / 3 - 2 * i) / 2 +
                        ((height - height / 16) / 3 - 2 * i) / 4,
                    (((width / 3) * 2) / 3) * 2 - 2 * i - 2 * i,
                    ((height - height / 16) / 3 - 2 * i) / 4 - i
                ),
                !0 === Lt(H(multiplayer.mapId, "id").song, "id").explicit &&
                    (imageMode(CORNER),
                    Wt(
                        St.explicit,
                        "stretch",
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) -
                            2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    ),
                    Ft(
                        "rcorner",
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) -
                            2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    )) &&
                    ($t = Pt("explicit", xt)),
                fill(0, 25),
                rect(
                    width / 3 + i + ((((width / 3) * 2) / 3) * 2 - 2 * i) + i,
                    height / 16 + i,
                    ((width / 3) * 2) / 3 - i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                );
            textAlign(LEFT, CENTER);
            for (t = 0; t < 8; t++) {
                var o = "",
                    n = !1;
                0 === t
                    ? (o =
                          void 0 === multiplayer.mapId
                              ? Pt("menu_lvl_notUploaded", xt)
                              : Pt("menu_lvl_ID", xt, multiplayer.mapId))
                    : 1 === t
                    ? (void 0 !== (o = H(multiplayer.mapId, "id").bpmDis) &&
                          (o =
                              !0 === o[0]
                                  ? Pt(
                                        "menu_lvl_foresight_range",
                                        xt,
                                        $i(o[1] * Tt.mods.bpm),
                                        $i(o[2] * Tt.mods.bpm)
                                    )
                                  : $i(o * Tt.mods.bpm)),
                      (o = Pt("menu_lvl_bpm", xt, o)),
                      1 !== Tt.mods.bpm && (n = !0))
                    : 2 === t
                    ? (void 0 !== (o = H(multiplayer.mapId, "id").arDis) &&
                          (o =
                              !0 === o[0]
                                  ? Pt(
                                        "menu_lvl_foresight_range",
                                        xt,
                                        $i(o[1] * Tt.mods.foresight),
                                        $i(o[2] * Tt.mods.foresight)
                                    )
                                  : $i(o * Tt.mods.foresight)),
                      (o = Pt("menu_lvl_foresight", xt, o)),
                      1 !== Tt.mods.foresight && (n = !0))
                    : 3 === t
                    ? ((o = H(multiplayer.mapId, "id").hw),
                      (w = H(multiplayer.mapId, "id").ar),
                      (o = null == o ? w : o),
                      (o *= Tt.mods.hitWindow),
                      (o = Pt("menu_lvl_hitWindow", xt, $i(o))),
                      1 !== Tt.mods.hitWindow && (n = !0))
                    : 4 === t
                    ? ((o = H(multiplayer.mapId, "id").hpD),
                      (o = Pt("menu_lvl_hpD", xt, $i(o))))
                    : 5 === t
                    ? ((o = Wo(
                          H(multiplayer.mapId, "id").len * (1 / Tt.mods.bpm),
                          "min:sec"
                      )),
                      (o = Pt("menu_lvl_length", xt, o)),
                      1 !== Tt.mods.bpm && (n = !0))
                    : 6 === t
                    ? (o = Hn(floor(100 * Bn(multiplayer.mapId)) / 100))
                    : 7 === t &&
                      (o = H(multiplayer.mapId, "id").ranked
                          ? H(multiplayer.mapId, "id").special
                              ? Pt("menu_lvl_special", xt)
                              : Pt("menu_lvl_ranked", xt)
                          : Pt("menu_lvl_unranked", xt)),
                    n ? fill($.modText) : fill($.text),
                    Dt(
                        o,
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) +
                            2 * i,
                        height / 16 +
                            1.75 * i +
                            (((height - height / 16) / 3 - 4 * i) / 8) *
                                (t + 1) -
                            ((height - height / 16) / 3 - 3 * i) / 8 / 4,
                        ((width / 3) * 2) / 3 - i - 2 * i,
                        ((height - height / 16) / 3 - 4 * i) / 8
                    );
            }
            fill(0, 25),
                rect(
                    width / 3 + i,
                    height / 16 + i + ((height - height / 16) / 3 - 2 * i) + i,
                    (width / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                ),
                fill($.main),
                rect(
                    width / 3 + i,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i / 2 / 2),
                    (width / 3) * 2 - 2 * i,
                    i / 2
                ),
                fill($.text),
                textAlign(CENTER, CENTER);
            (o = null == (o = H(multiplayer.mapId, "id").desc) ? "" : o),
                textSize(i / 1.25),
                text(
                    0 < o.length
                        ? '"' + o + '"'
                        : Pt("menu_lvl_noDescription", xt),
                    (width / 3) * 2 - ((width / 3) * 2 - 2 * i) / 2,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                            2 /
                            2 -
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                            2 /
                            2 -
                        i / 2 / 2,
                    (width / 3) * 2 - 2 * i,
                    ((height - height / 16) / 3 - 2 * i + i / 2 / 2) / 2
                ),
                Dt(
                    Pt(
                        "multiplayer_modsDesc",
                        xt,
                        multiplayer.selMods.bpm,
                        multiplayer.selMods.hw
                    ),
                    (width / 3) * 2,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                            2 /
                            2 +
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) / 2,
                    (width / 3) * 2 - 5 * i - 2 * i,
                    ((height - height / 16) / 3 - 2 * i + i / 2 / 2) / 2 / 3
                );

            Bt.lvl.showMods
                ? (Bt.lvl.modsX += At(1, Bt.lvl.modsX, 0.2))
                : (Bt.lvl.modsX += At(0, Bt.lvl.modsX, 0.2)),
                0 < Ot(100 * Bt.lvl.modsX) / 100 &&
                    (push(),
                    translate(
                        -(constrain(Bt.lvl.modsX, 0, 1) * ((width / 3) * 2)),
                        0
                    ),
                    fill(
                        lerpColor(
                            $.shade,
                            $.main,
                            constrain(Bt.lvl.modsX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(width, height / 16, (width / 3) * 2, height),
                    push(),
                    multiplayer.isHost
                        ? multiplayer.modsNSM.host.draw({
                              x: width,
                              y: height / 16,
                              width: (width / 3) * 2,
                              height:
                                  height -
                                  ((height - height / 16) / 3 / 3 -
                                      i / 2 +
                                      2 * i) -
                                  height / 16,
                              stacked: !1,
                              maxBarHeight: height / 24,
                              buffer: (height - height / 16) / 64,
                              mouseIsPressedBlock: vt.active,
                          })
                        : multiplayer.modsNSM.player.draw({
                              x: width,
                              y: height / 16,
                              width: (width / 3) * 2,
                              height:
                                  height -
                                  ((height - height / 16) / 3 / 3 -
                                      i / 2 +
                                      2 * i) -
                                  height / 16,
                              stacked: !1,
                              maxBarHeight: height / 24,
                              buffer: (height - height / 16) / 64,
                              mouseIsPressedBlock: vt.active,
                          }),
                    // Bt.lvl.modsNSM.draw({
                    // x: width,
                    // y: height / 16,
                    // width: width / 3 * 2,
                    // height: height - ((height - height / 16) / 3 / 3 - i / 2 + 2 * i) - height / 16,
                    // stacked: !1,
                    // maxBarHeight: height / 24,
                    // buffer: (height - height / 16) / 64,
                    // mouseIsPressedBlock: vt.active
                    // }),
                    pop(),
                    translate((width / 3) * 2, 0),
                    fill(
                        lerpColor(
                            $.shade,
                            $.overlayShade,
                            constrain(Bt.lvl.modsX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(
                        width / 3,
                        height / 16 +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2,
                        width,
                        (height - height / 16) / 3 / 3 - i / 2 + 2 * i
                    ),
                    Kt(
                        width / 3 + i + (((width / 3) * 2 - 2 * i) / 2 + i / 2),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            (((height - height / 16) / 3 / 3 - i / 2) / 4) * 3 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2,
                        Pt("menu_back", xt),
                        Bt.lvl.buttonHover,
                        11
                    ),
                    multiplayer.isHost
                        ? Kt(
                              width / 3 +
                                  i +
                                  (((width / 3) * 2 - 2 * i) / 2 + i / 2),
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2 +
                                  (((height - height / 16) / 3 / 3 - i / 2) /
                                      4) *
                                      3 -
                                  i / 2 -
                                  ((height - height / 16) / 3 / 3 - i / 2) / 2 -
                                  i / 2,
                              ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                              ((height - height / 16) / 3 / 3 - i / 2) / 2,
                              Pt("mods_practice", xt),
                              Bt.lvl.buttonHover,
                              15
                          )
                        : void 0,
                    fill($.text),
                    textAlign(LEFT, CENTER),
                    Dt(
                        Pt("mods_scoreMultiplier", xt, wn(Tt.mods)),
                        width / 3 + i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            ((height - height / 16) / 3 / 3 - i / 2) / 4 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2
                    ),
                    Kt(
                        width / 3 + i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            (((height - height / 16) / 3 / 3 - i / 2) / 4) * 3 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2,
                        Pt("mods_reset", xt),
                        Bt.lvl.buttonHover,
                        13
                    ),
                    pop());
            // Po((width < height ? width : height) / 16 / 2 + i / 4, height / 6, (width < height ? width : height) / 16, (width < height ? width : height) / 16, Bn(multiplayer.mapId), H(multiplayer.mapId, "id").ranked, H(multiplayer.mapId, "id").special);
            // Po(kt, (height - height / 16 - 2 * kt) / 16 / 2, kt, kt, Bn(multiplayer.mapId), H(multiplayer.mapId, "id").ranked, H(multiplayer.mapId, "id").special)
        }
        pop();
    }
};

c.pages = function () {
    switch (
        (fill($.main),
        noStroke(),
        rectMode(CORNER),
        rect(0, 0, width, height),
        Bt.screen)
    ) {
        case "main":
            c.home();
            break;
        case "lvl":
            c.lvl();
            break;
        case "online":
            c.online();
            break;
        case "song":
            c.song();
            break;
        case "account":
            "" === T.uuid
                ? c.account.signedOut()
                : Bt.account.countryScreen
                ? c.account.countryScreen()
                : !1 !== Bt.account.friendsScreen
                ? c.account.friendsScreen()
                : c.account.signedIn();
            break;
        case "settings":
            c.settings();
            break;
        case "credits":
            c.credits();
            break;
        case "socialMedia":
            c.socialMedia();
            break;
        case "patreon":
            c.patreon();
            break;
        case "changelog":
            c.changelog();
            break;
        case "morePulsus":
            c.morePulsus();
            break;
        case "multiplayer":
            c.multiplayer();
    }
    fill($.shade),
        rectMode(CORNER),
        noStroke(),
        rect(0, 0, width, ceil(height / 16)),
        stroke($.text),
        strokeWeight(height / lerp(128, 256, 0.25)),
        // --- EDITED CODE (Sets visuals of navbar to X while in multiplayer)
        go(height / 64, height / 64, Bt.side || multiplayer.code != ""),
        0 === T.uuid.length
            ? (fill(255),
              noStroke(),
              rectMode(CORNER),
              rect(
                  height / 16,
                  (height / 16 - height / 24) / 2,
                  height / 24,
                  height / 24
              ))
            : (imageMode(CORNER),
              "Loading..." !== Ut(T.uuid, "uuid").pp &&
                  void 0 !== Ut(T.uuid, "uuid").pp &&
                  image(
                      _t(Ut(T.uuid, "uuid").pp),
                      height / 16,
                      (height / 16 - height / 24) / 2,
                      height / 24,
                      height / 24
                  )),
        textAlign(LEFT, CENTER),
        fill($.text),
        noStroke(),
        Dt(
            0 < T.uuid.length
                ? Ut(T.uuid, "uuid").user +
                      " / #" +
                      Ut(T.uuid, "uuid").rank +
                      " / " +
                      Pt("performancePoints", xt, floor(100 * Tn(T.uuid)) / 100)
                : Pt("notLoggedIn", xt),
            height / 16 + height / 32 + height / 64,
            height / 32,
            width,
            height / 32
        );
    var e = K();
    textAlign(RIGHT, CENTER),
        fill($.text),
        noStroke(),
        Dt(
            e < 5e6
                ? Pt("menu_lvl_saveData_ok", xt, ie(e), ie(5e6))
                : Pt(
                      e < 8e6
                          ? "menu_lvl_saveData_lots"
                          : "menu_lvl_saveData_max",
                      xt,
                      ie(e),
                      ie(8e6)
                  ),
            width - height / 32 / 2,
            height / 32,
            width / 4,
            height / 32
        ),
        imageMode(CENTER, CENTER),
        5e6 <= e &&
            image(
                e < 8e6 ? St.warningOrange : St.warningRed,
                width - height / 32 - width / 4 - height / 32 / 2,
                height / 32,
                height / 32,
                height / 32
            ),
        Ft(
            "rcorner",
            width - height / 32 - width / 4 - height / 32,
            0,
            width,
            height / 16
        ) && ($t = Pt("saveData_info", xt)),
        !1 === Bt.trans &&
            (!0 === Bt.side
                ? (Bt.sideX += At(0, Bt.sideX, 0.2))
                : (Bt.sideX += At(-1, Bt.sideX, 0.2))),
        textAlign(LEFT, CENTER),
        fill($.shade),
        noStroke(),
        rectMode(CORNER),
        rect(
            (width / 5) * Bt.sideX,
            height / 16,
            (width / 5) * Bt.sideW,
            height - height / 16
        ),
        (Bt.sideHoverY += At(
            (Bt.sideHovering + 1) * (height / 16) + height / 16 / 2,
            Bt.sideHoverY,
            0.3
        )),
        (Bt.navBox += At(
            Bt.sideHovering * (height / 16) + 22.5,
            Bt.navBox,
            0.15
        ));
    for (var t = 0; t < Bt.nav.length; t++) {
        mouseX < abs(width / 5 + (width / 5) * Bt.sideX) &&
            mouseY > height / 16 + (height / 16) * t + height / 16 / 2 &&
            mouseY <
                height / 16 +
                    (height / 16) * t +
                    (height / 16 + height / 16 / 2) &&
            (Bt.sideHovering = t),
            rectMode(CENTER),
            fill($.text, 255 * Bt.sideTextA),
            push(),
            translate(
                (width / 6) * Bt.sideX + width / 64,
                Bt.sideHoverY + height / 32
            ),
            rotate(Bt.navBox),
            rect(0, 0, height / 16 / 4, height / 16 / 4),
            pop(),
            push(),
            (drawingContext.globalAlpha = Bt.sideTextA);
        var i = Bt.screen === Bt.nav[t][1] ? $.text : $.textDown,
            o =
                (textAlign(LEFT, CENTER),
                fill(i),
                Dt(
                    Pt(Bt.nav[t][0], xt),
                    (width / 6) * Bt.sideX + width / 32 + (height / 32) * 1.5,
                    height / 8 + (height / 16) * t,
                    width / 6 - (width / 32) * 2,
                    height / 32
                ),
                St[Bt.nav[t][2]]),
            n = new OffscreenCanvas(o.width, o.height).getContext("2d"),
            s = new p5.Image(n.canvas.width, n.canvas.height);
        (s.canvas = n.canvas),
            (s.ctx = n),
            (s.ctx.fillStyle = i.toString()),
            s.ctx.fillRect(0, 0, n.canvas.width, n.canvas.height),
            (s.ctx.globalCompositeOperation = "destination-atop"),
            s.ctx.drawImage(o.canvas, 0, 0),
            imageMode(CENTER),
            Wt(
                s,
                "contain",
                (width / 6) * Bt.sideX + width / 32 + height / 32 / 2,
                height / 8 + (height / 16) * t,
                height / 32,
                height / 32
            ),
            pop();
    }
};

cs.paused = function () {
    var e, t, i;
    Tt.paused
        ? (void 0 === Tt.pauseMillis && (Tt.pauseMillis = millis()),
          cursor(),
          (i = t = e = 0),
          (i = Tt.retry
              ? ((e = 1 + It(millis() - Tt.retryMillis, 500, -1, 26)),
                (t = (-width / 4) * 3),
                lerp(
                    200,
                    0,
                    constrain((millis() - Tt.retryMillis) / 500, 0, 1)
                ))
              : ((t =
                    !1 === Tt.resumeTime
                        ? ((e = It(millis() - Tt.pauseMillis, 750, 1, 26)),
                          width / 4)
                        : ((e = 1 + It(millis() - Tt.resumeTime, 1500, -1, 26)),
                          (-width / 4) * 3)),
                lerp(
                    0,
                    200,
                    constrain((millis() - Tt.pauseMillis) / 500, 0, 1)
                ))),
          rectMode(CORNER),
          multiplayer.code == ""
              ? (fill(0, i),
                rect(0, 0, width, height),
                fill(255, i),
                textAlign(LEFT, TOP),
                textSize(height / 64),
                text(Pt("game_paused", xt), kt, kt),
                noStroke(),
                push(),
                translate(lerp(-t, 0, e), 0),
                Kt(
                    width / 2 - width / 4 / 2,
                    height / 2 - height / 8 / 2 - (height / 8) * 1.25,
                    width / 4,
                    height / 8,
                    Pt("game_continue", xt),
                    Tt.buttonHover,
                    2
                ),
                Kt(
                    width / 2 - width / 4 / 2,
                    height / 2 - height / 8 / 2 + (height / 8) * 1.25,
                    width / 4,
                    height / 8,
                    Pt("game_backToMenu", xt),
                    Tt.buttonHover,
                    1
                ),
                pop(),
                push(),
                translate(lerp(t, 0, e), 0),
                Kt(
                    width / 2 - width / 4 / 2,
                    height / 2 - height / 8 / 2,
                    width / 4,
                    height / 8,
                    Tt.replay.on
                        ? Pt("game_replayRetry", xt)
                        : Pt("game_retry", xt),
                    Tt.buttonHover,
                    0
                ),
                pop(),
                !1 !== Tt.resumeTime
                    ? (void 0 === Tt.resumePos && (Tt.resumePos = 4),
                      (Tt.resumePos += At(
                          ceil(3 - (millis() - Tt.resumeTime) / 1e3),
                          Tt.resumePos,
                          0.1
                      )),
                      textAlign(CENTER, CENTER),
                      fill(0, 175, 255),
                      textSize(height / 2),
                      Un(
                          width / 2,
                          height / 2,
                          height / 3,
                          0.8,
                          4 - Tt.resumePos,
                          [
                              {
                                  text: "",
                                  color: color(255),
                              },
                              {
                                  text: "3",
                                  color: color(0, 175, 255),
                              },
                              {
                                  text: "2",
                                  color: color(0, 175, 255),
                              },
                              {
                                  text: "1",
                                  color: color(0, 175, 255),
                              },
                          ]
                      ),
                      ceil(3 - (millis() - Tt.resumeTime) / 1e3) <= 0 &&
                          ((Tt.timeStart = millis()),
                          (Tt.paused = !Tt.paused),
                          (Tt.resumeTime = !1)),
                      fill(255),
                      Dt(
                          Pt("game_resuming", xt),
                          width / 2,
                          height / 4,
                          width / 2 / 1.5,
                          height / 2 / 1.5
                      ))
                    : (Tt.resumePos = void 0))
              : // --- EDITED CODE (Blank retry screen during multiplayer)
                (fill(0, 150),
                rect(0, 0, width, height),
                fill(255, 150),
                textAlign(LEFT, TOP),
                textSize(height / 64),
                text(Pt("multiplayer_waiting", xt), kt, kt),
                noStroke()))
        : (Tt.pauseMillis = void 0);
};
Mn = function (e) {
    switch (e) {
        case "menu":
            (Bt.lvl.prevPlay = Tt.song),
                (Bt.lvl.loading = !1),
                (Tt.buttonHover[1] /= 2),
                Tt.replay.on && Yn(Tt.replay.preMods),
                Vi("menu", "game");
            if (multiplayer.code != "") {
                Bt.screen = "multiplayer";
            }
            break;
        case "retry":
            (Tt.disMode = Tt.paused ? 1 : 3),
                (Tt.retry = !0),
                (Tt.buttonHover[0] /= 2),
                (Bt.lvl.prevPlay = Tt.song),
                (Tt.songVol = 100);
            break;
        case "continue":
            !1 === Tt.resumeTime
                ? (Tt.resumeTime = millis())
                : (Tt.resumeTime = !1);
    }
};

// !!! Disable score submission and show other players' score

cs.resultsScreen = function () {
    var e =
            "" !== T.uuid &&
            !Tt.failed &&
            !Tt.mods.auto &&
            H(Rt[Bt.lvl.sel], "id").ranked &&
            !Tt.replay.on &&
            0 === Tt.mods.startPos &&
            0 === Tt.mods.endPos,
        t =
            (!Tt.scoreSubmitted && e && (Tt.scoreSubmitted = !0), // --- EDITED CODE (Stop score submission)
            !1 === Tt.endMillis && (Tt.endMillis = millis()),
            (Tt.scoreFinal = Gi(Tt.newScore.log)),
            Ot(Tt.scoreFinal * wn(Tt.mods, !0))),
        i = t / Tt.scoreMax,
        o =
            (cursor(),
            void 0 === Tt.retryMillis
                ? fill(0, lerp(0, 245, Ln(Tt.endMillis, 500, 0, 1)))
                : fill(0, lerp(245, 0, Ln(Tt.retryMillis, 500, 0, 1))),
            rectMode(CORNER),
            noStroke(),
            rect(0, 0, width, height + height / 64),
            push(),
            void 0 === Tt.retryMillis
                ? translate(0, lerp(-height, 0, Ln(Tt.endMillis, 500, 0, 1)))
                : translate(0, lerp(0, -height, Ln(Tt.retryMillis, 500, 0, 1))),
            imageMode(CORNER),
            push(),
            noStroke(),
            fill(255, 0),
            rectMode(CORNER),
            rect(0, 0, width, height),
            drawingContext.clip(),
            !1 !== Tt.bg
                ? (imageMode(CENTER),
                  Wt(
                      _t(
                          "https://i.imgur.com/pUovCs5.png" === Tt.bg &&
                              0 < Bt.settings.defaultBackground.length
                              ? Bt.settings.defaultBackground
                              : Tt.bg
                      ),
                      "zoom",
                      width / 2,
                      height / 2,
                      width,
                      height
                  ))
                : (imageMode(CENTER),
                  Wt(St.bg, "zoom", width / 2, height / 2, width, height)),
            pop(),
            rectMode(CORNER),
            fill(0, 245),
            rect(0, 0, width, height),
            fill(2, 150),
            rect(kt, kt, (width / 3) * 2 - kt, Ot(height / 32)),
            fill(0, 150),
            rect(
                kt,
                kt + Ot(height / 32),
                (width / 3) * 2 - kt,
                height / 4 - kt - Ot(height / 32)
            ),
            fill(255),
            textSize(height / 64),
            textAlign(LEFT, CENTER),
            text(
                Pt("game_info_title", xt),
                kt + height / 64 / 2,
                kt + height / 64
            ),
            push(),
            height / 4 - 3 * kt - Ot(height / 32)),
        n = (translate(kt, 2 * kt + Ot(height / 32)), St.defaultPP),
        s = Pt("defaultUsername", xt),
        r =
            void 0 === Ut(Tt.author, "uuid").user
                ? Pt("defaultUsername", xt)
                : Ut(Tt.author, "uuid").user,
        n =
            (Tt.mods.auto
                ? ((s = "Pulsus"), (n = St.logo))
                : Tt.replay.on
                ? ((s = Ut(Tt.replay.user, "uuid").user),
                  (n = _t(Ut(Tt.replay.user, "uuid").pp)))
                : "" !== T.uuid &&
                  ((s =
                      void 0 === Ut(T.uuid, "uuid").user
                          ? Pt("defaultUsername", xt)
                          : Ut(T.uuid, "uuid").user),
                  (n = _t(Ut(T.uuid, "uuid").pp))),
            imageMode(CORNER),
            image(n, kt, 0, o, o),
            translate(o + kt, 0),
            fill(255),
            textAlign(LEFT, CENTER),
            textStyle(BOLD),
            textSize(o / 2 / 1.25),
            Pt("game_levelComplete", xt));
    if (0 === Tt.hitStats[Tt.hitValues.length - 1]) {
        for (var h = 0, a = 0; a < Tt.hitValues.length; a++)
            h += Tt.hitStats[a];
        n =
            Tt.hitStats[0] === h
                ? Pt("game_levelMarvelous", xt)
                : Tt.hitStats[0] + Tt.hitStats[1] === h
                ? Pt("game_levelPerfect", xt)
                : Pt("game_levelFullCombo", xt);
    }
    Tt.failed && (n = Pt("game_levelFailed", xt)),
        Tt.replay.on && (n = Pt("game_replayComplete", xt)),
        text(n, kt, o / 4),
        textStyle(NORMAL),
        textSize(o / 4 / 1.25),
        text(
            Pt("game_info_level", xt, Tt.title, r, Ot(100 * Tt.stars) / 100),
            kt,
            o / 2 + o / 8
        ),
        text(
            Pt("game_info_play", xt, s, Vo(Tt.mods)),
            kt,
            o / 2 + o / 4 + o / 8
        ),
        pop(),
        fill(2, 150),
        rect(kt, kt + height / 4, width / 3 - kt, Ot(height / 32)),
        fill(0, 150),
        rect(
            kt,
            kt + height / 4 + Ot(height / 32),
            width / 3 - kt,
            (height / 4) * 3 - 2 * kt - Ot(height / 32)
        ),
        fill(255),
        textSize(height / 64),
        textAlign(LEFT, CENTER),
        text(
            Pt("game_sections_title", xt),
            kt + height / 64 / 2,
            kt + height / 4 + height / 64
        ),
        push(),
        translate(kt, kt + height / 4 + height / 32);
    var n = height / 32,
        l = 1.25 * n;
    textSize(n),
        0 === Tt.sectionAcc.length &&
            0 < Tt.sections.length &&
            (Tt.sectionAcc = Wn(Tt.sectionPerformance, Tt.sections)),
        fill(255);
    for (a = 0; a < Tt.sections.length; a++) {
        var d = Tt.sections[a + 1];
        textAlign(LEFT, CENTER),
            text(Tt.sections[a].name, kt, l * a + kt),
            textAlign(RIGHT, CENTER),
            text(
                (isNaN(Tt.sectionAcc[a]) || (d && d.time <= 0)
                    ? "--.---"
                    : Tt.sectionAcc[a].toFixed(3)) + "%",
                width / 3 - 2 * kt,
                l * a + kt
            );
    }
    pop(),
        fill(2, 150),
        rect((width / 3) * 2 + kt, kt, width / 3 - 2 * kt, Ot(height / 32)),
        fill(0, 150),
        rect(
            (width / 3) * 2 + kt,
            kt + Ot(height / 32),
            width / 3 - 2 * kt,
            (height / 3) * 2 - kt - Ot(height / 32)
        ),
        fill(255),
        textSize(height / 64),
        textAlign(LEFT, CENTER),
        text(
            Pt("game_performance_title", xt),
            (width / 3) * 2 + kt + height / 64 / 2,
            kt + height / 64
        ),
        push();
    var g = (width / 3) * 2 + kt,
        c = kt + Ot(height / 32),
        f = (translate(g, c), width / 3 - 4 * kt),
        u = (f / 1920) * 1080;
    if (((Tt.performanceDotCallback = null), !1 === Tt.performanceChart))
        (Tt.performanceChart = createGraphics(640, 360, P2D)),
            Vn(
                Tt.performanceChart,
                640,
                360,
                Tt.hw,
                Tt.hitValues,
                Tt.sectionPerformance,
                Tt.timeEnd
            );
    else {
        imageMode(CORNER), image(Tt.performanceChart, kt, kt, f, u);
        var v = u / 75;
        let e = null;
        for (const x of Tt.sectionPerformance) {
            var m = Kn(f, u, Tt.hitValues, Tt.timeEnd, x);
            Ft("ccenter", m[0] + kt + g, m[1] + kt + c, 4 * v, 4 * v) &&
                (e = x);
        }
        if (e) {
            push();
            var r = Kn(f, u, Tt.hitValues, Tt.timeEnd, e),
                [s, n, p] = e;
            fill(Tt.hitValues[n].color),
                strokeWeight(v),
                stroke($.select),
                ellipseMode(CENTER),
                ellipse(r[0] + kt, r[1] + kt, 4 * v, 4 * v);
            const S = Math.floor((s / Tt.bpm) * 60 * 1e3 + Tt.mods.startPos);
            n = ((p / Tt.bpm) * 60 * 1e3).toFixed(3);
            ($t = Pt(
                "game_performanceDot_tooltip",
                xt,
                Pt("milliseconds_short", xt, S),
                Pt("milliseconds_short", xt, n)
            )),
                (Tt.performanceDotCallback = () => {
                    So(S),
                        Gn({
                            type: "success",
                            message: "game_performanceDot_copied",
                            keys: [Pt("milliseconds_short", xt, S)],
                        });
                }),
                pop();
        }
    }
    translate(0, (f / 1920) * 1080 + 2 * kt);
    var b =
        (height / 3) * 2 - 2 * kt - Ot(height / 32) - kt - (f / 1920) * 1080;
    textSize(b / Tt.hitValues.length / 1.25);
    for (a = 0; a < Tt.hitValues.length; a++) {
        var w = Tt.hitValues[a];
        fill(w.color),
            textAlign(LEFT, CENTER),
            text(w.name, kt, (b / Tt.hitValues.length) * a),
            textAlign(RIGHT, CENTER),
            text(Tt.hitStats[a], kt + f, (b / Tt.hitValues.length) * a);
    }
    pop(),
        fill(0, 150),
        rect(
            kt + width / 3,
            kt + height / 4,
            width / 3 - kt,
            (height / 4) * 3 - 2 * kt
        ),
        push(),
        translate(kt / 2, 0);
    for (var C = [""], a = Tt.ranks.length - 1; 0 <= a; a--) {
        var y = Tt.ranks[a];
        C.push({
            text: y.symbol,
            color: on(a),
        });
    }
    // --- EDITED CODE HERE (Show multiplayer scores on results)
    (tempUserDraw = Object.values(multiplayer.roomUsers).sort(compareScore)),
        tempUserDraw.forEach((user, index) => {
            user.draw(
                width / 2 - width / 10 + kt / 16,
                height / 2 + (index - 2) * (height / 10),
                width / 5
            );
        });
    (o = (height / 4) * 3 - 2 * kt),
        translate(0, height / 4 + kt + (o / 3) * 2 + (height / 16) * 0.75),
        textAlign(CENTER, CENTER),
        fill(255),
        textStyle(NORMAL),
        (i = height / 28),
        Tt.submittedScore?.top &&
            (push(),
            fill(201, 176, 55),
            textSize(1.5 * i),
            textStyle(BOLD),
            text(Pt("game_newTopPlay", xt, t), width / 2, -1.5 * i),
            pop()),
        textSize(i),
        text(Pt("game_score", xt, t), width / 2, 1.25 * i),
        text(
            Pt("game_accuracy", xt, Tt.acc.toFixed(3)),
            width / 2,
            1.25 * i * 2
        ),
        text(Pt("game_maxCombo", xt, Tt.comboMax), width / 2, 1.25 * i * 3),
        pop(),
        textFont(Je.n),
        noStroke(),
        Kt(
            (width / 3) * 2 + kt,
            height - (height / 8) * 2 - 2 * kt,
            width / 3 - 2 * kt,
            height / 8,
            Tt.replay.on ? Pt("game_replayRetry", xt) : Pt("game_retry", xt),
            Tt.buttonHover,
            0
        ),
        Kt(
            (width / 3) * 2 + kt,
            height - height / 8 - kt,
            width / 3 - 2 * kt,
            height / 8,
            Pt("game_backToMenu", xt),
            Tt.buttonHover,
            1
        ),
        pop();
};

// !!! Add in-game leaderboard

cs.field.draw = function (A) {
    var e = Tt.bpmNew();
    (Tt.lastDraw = millis()),
        background(0, 0, 0, 255),
        imageMode(CORNER),
        Wt(
            0 < Bt.settings.defaultBackground.length
                ? _t(Bt.settings.defaultBackground)
                : St.bg,
            "zoom",
            0,
            0,
            width,
            height
        ),
        !1 !== Tt.bg &&
            "https://i.imgur.com/pUovCs5.png" !== Tt.bg &&
            "" !== Tt.bg &&
            Wt(
                _t(Tt.bg),
                "zoom",
                (width -
                    (width / 1920 > height / 1080
                        ? (1920 / 1080) * height
                        : width)) /
                    2,
                (height -
                    (width / 1920 > height / 1080 ? height : 0.5625 * width)) /
                    2,
                width / 1920 > height / 1080 ? (1920 / 1080) * height : width,
                width / 1920 > height / 1080 ? height : 0.5625 * width
            ),
        colorMode(HSB),
        fill(
            Tt.effected.backgroundOverlayColor,
            Tt.effected.backgroundOverlaySaturation,
            Tt.effected.backgroundOverlayBrightness,
            Tt.effected.backgroundOverlayAlpha
        ),
        noStroke(),
        rect(0, 0, width, height),
        colorMode(RGB),
        fill(0, (Bt.settings.bgDim / 100) * 255),
        rectMode(CORNER),
        rect(0, 0, width, height),
        rectMode(CORNER),
        fill(255, Tt.transBackA),
        rect(0, 0, width, height),
        colorMode(HSB);
    for (var t = A.length - 1; 0 <= t; t--) {
        var i = A[t],
            o = (push(), 0),
            n = 0,
            F = 0,
            D = width,
            X = 0,
            W = height,
            s =
                (width / 1920 > height / 1080
                    ? ((o = ((1920 / 1080) * height) / 240),
                      (n = height / 135),
                      (F = (width - (1920 / 1080) * height) / 2),
                      (D = width - (width - (1920 / 1080) * height) / 2))
                    : ((o = width / 240),
                      (n = (0.5625 * width) / 135),
                      (X = (height - 0.5625 * width) / 2),
                      (W = height - (height - 0.5625 * width) / 2)),
                (Tt.board.str *
                    (Tt.board.c / 64) *
                    (Tt.board.h < Tt.board.w
                        ? Tt.board.h / 0.75
                        : Tt.board.w / 0.75)) /
                    2),
            r = 0,
            h = 0,
            U = 0,
            a = 0,
            L = Tt.effected.tileH[Tt.beat[i][0]],
            l = Tt.effected.tileW[Tt.beat[i][0]],
            d =
                ceil(
                    ((Tt.board.h * Tt.board.c) / 4) * L +
                        (s < s * L ? (s / 2) * L : (-s / 2) * L)
                ) + 2.5,
            g =
                ceil(
                    ((Tt.board.w * Tt.board.c) / 4) * l +
                        (s < s * l ? (s / 2) * l : (-s / 2) * l)
                ) + 2.5,
            c = (Tt.board.w, Tt.board.c, Tt.board.w, Tt.board.c, 1),
            f = 1,
            u = 1,
            v = 1,
            K = 1,
            V = 1,
            M = 0,
            q = 0,
            m = 1,
            p = 1,
            b = 0,
            Z = 0,
            j = !1,
            r =
                ((Tt.board.w * Tt.board.c * 3) / 8) *
                    ((Tt.beat[i][0] % 3) - 1) +
                width / 2 +
                Tt.effected.tileX[Tt.beat[i][0]] * o,
            h =
                ((Tt.board.h * Tt.board.c * 3) / 8) *
                    (floor(Tt.beat[i][0] / 3) - 1) +
                height / 2 +
                Tt.effected.tileY[Tt.beat[i][0]] * n,
            U =
                ((Tt.board.w * Tt.board.c * 3) / 8) *
                    ((Tt.beat[i][0] % 3) - 1) +
                width / 2 +
                Tt.effected.tileX[Tt.beat[i][0]] * o,
            a =
                ((Tt.board.h * Tt.board.c * 3) / 8) *
                    (floor(Tt.beat[i][0] / 3) - 1) +
                height / 2 +
                Tt.effected.tileY[Tt.beat[i][0]] * n,
            c = 1,
            f = 1,
            u = 1,
            v = 1;
        switch (
            (Z =
                Tt.time < Tt.beat[i][1]
                    ? 0
                    : 1 === Tt.beat[i][5] &&
                      Tt.time < Tt.beat[i][1] + Tt.beat[i][6]
                    ? 1
                    : 2)
        ) {
            default:
                b = 1 - (Tt.beat[i][1] - Tt.time) / Tt.ar;
                break;
            case 1:
                b =
                    1 -
                    (Tt.beat[i][1] + Tt.beat[i][6] - Tt.time) / Tt.beat[i][6];
                break;
            case 2:
                b =
                    (Tt.time -
                        (Tt.beat[i][1] +
                            (1 === Tt.beat[i][5] ? Tt.beat[i][6] : 0))) /
                    Tt.ar;
        }
        switch (Z) {
            default:
                switch (Tt.beat[i][13]) {
                    default:
                        (u = c = 0), (v = f = 1);
                        break;
                    case 1:
                        (h = X - d / 2), (m = 0), (p = 8);
                        break;
                    case 7:
                        (r =
                            ((Tt.board.w * Tt.board.c * 3) / 8) * (u = c = 0) +
                            width / 2 +
                            Tt.effected.tileX[4] * o),
                            (h =
                                ((Tt.board.h * Tt.board.c * 3) / 8) *
                                    (floor(4 / 3) - 1) +
                                height / 2 +
                                Tt.effected.tileY[4] * n);
                        break;
                    case 3:
                        K = 0;
                        break;
                    case 4:
                        (h = W + d / 2), (m = 0), (p = 8);
                        break;
                    case 5:
                        (r = F - g / 2), (m = 0), (p = 8);
                        break;
                    case 6:
                        (r = D + g / 2), (m = 0), (p = 8);
                        break;
                    case 2:
                        (u = c = 0), (r = width / 2), (h = height / 2);
                        break;
                    case 8:
                        (u = c = 0), (r -= g / 2), (h -= d / 2);
                        break;
                    case 9:
                        (u = c = 0), (r += g / 2), (h -= d / 2);
                        break;
                    case 10:
                        (u = c = 0), (r -= g / 2), (h += d / 2);
                        break;
                    case 11:
                        (u = c = 0), (r += g / 2), (h += d / 2);
                        break;
                    case 12:
                        c = 0;
                        break;
                    case 13:
                        u = 0;
                        break;
                    case 14:
                        (u = c = 0), (M = -82.5);
                        break;
                    case 15:
                        (j = !0), (v = f = 0);
                }
            case 1:
                break;
            case 2:
                switch (Tt.beat[i][14]) {
                    default:
                        v = f = 0;
                        break;
                    case 1:
                        (a = lerp(X - d / 2, h, 2)), (m = 8), (p = 0);
                        break;
                    case 7:
                        (U = lerp(
                            ((Tt.board.w * Tt.board.c * 3) / 8) * 0 +
                                width / 2 +
                                Tt.effected.tileX[4] * o,
                            r,
                            2
                        )),
                            (a = lerp(
                                ((Tt.board.h * Tt.board.c * 3) / 8) *
                                    (floor(4 / 3) - 1) +
                                    height / 2 +
                                    Tt.effected.tileY[4] * n,
                                h,
                                2
                            )),
                            (v = f = 2),
                            (m = 8),
                            (p = 0);
                        break;
                    case 3:
                        (K = 1), (V = 0);
                        break;
                    case 4:
                        (a = lerp(W + d / 2, h, 2)), (m = 8), (p = 0);
                        break;
                    case 5:
                        (U = lerp(F - g / 2, r, 2)), (m = 8), (p = 0);
                        break;
                    case 6:
                        (U = lerp(D + g / 2, r, 2)), (m = 8), (p = 0);
                        break;
                    case 2:
                        (v = f = 2),
                            (U = lerp(width / 2, r, 2)),
                            (a = lerp(height / 2, h, 2));
                        break;
                    case 8:
                        (v = f = 0), (U -= g / 2), (a -= d / 2);
                        break;
                    case 9:
                        (v = f = 0), (U += g / 2), (a -= d / 2);
                        break;
                    case 10:
                        (v = f = 0), (U -= g / 2), (a += d / 2);
                        break;
                    case 11:
                        (v = f = 0), (U += g / 2), (a += d / 2);
                        break;
                    case 12:
                        f = 0;
                        break;
                    case 13:
                        v = 0;
                        break;
                    case 14:
                        (v = f = 0), (q = 82.5);
                }
        }
        noStroke();
        var w = color(
                Tt.beat[i][11],
                void 0 === Tt.beat[i][16] ? 255 : Tt.beat[i][16],
                void 0 === Tt.beat[i][17] ? 255 : Tt.beat[i][17]
            ),
            G =
                lerp(75, 255, Bt.settings.noteEdgeOpacity / 100) *
                Tt.effected.boardA *
                Tt.effected.tileA[Tt.beat[i][0]],
            Y =
                lerp(0, 255, Bt.settings.holdProgressOpacity / 100) *
                Tt.effected.boardA *
                Tt.effected.tileA[Tt.beat[i][0]],
            J =
                lerp(0, 255, Bt.settings.notePaneOpacity / 100) *
                Tt.effected.boardA *
                Tt.effected.tileA[Tt.beat[i][0]],
            _ = (rectMode(CENTER), ellipseMode(CENTER), 1),
            L =
                (Tt.mods.hidden &&
                    (1 === Tt.beat[i][5]
                        ? (1 !== Z && 2 !== Z) ||
                          (_ =
                              1 -
                              constrain(
                                  (Tt.time - Tt.beat[i][1]) /
                                      ((Tt.beat[i][6] / 3) * 2),
                                  0,
                                  1
                              ))
                        : (_ = constrain(
                              (Tt.beat[i][1] - Tt.time - Tt.ar / 3) /
                                  ((Tt.ar / 3) * 2),
                              0,
                              1
                          ))),
                -1 !== Tt.selectedBeats.indexOf(i) &&
                    (colorMode(RGB),
                    stroke(
                        255,
                        175,
                        0,
                        (175 - Bt.settings.noteEdgeOpacity) *
                            (Tt.mods.hidden
                                ? abs((Tt.beat[i][1] - Tt.time) / Tt.ar)
                                : 1)
                    ),
                    strokeWeight(kt / 2),
                    colorMode(HSB)),
                translate(width / 2, height / 2),
                translate(Tt.effected.boardX * o, Tt.effected.boardY * n),
                scale(Tt.effected.boardW, Tt.effected.boardH),
                rotate(Tt.effected.boardR),
                translate(-width / 2, -height / 2),
                translate(
                    0 === lerp(h, a, b) ? 0 : lerp(r, U, b),
                    lerp(h, a, b)
                ),
                j ||
                    scale(
                        0 === lerp(u, v, b) ? 0 : lerp(c, f, b),
                        lerp(u, v, b)
                    ),
                rotate(lerp(M, q, b)),
                rotate(Tt.effected.tileR[Tt.beat[i][0]]),
                scale(
                    1 -
                        Tt.tilePressDis[Tt.beat[i][0]] *
                            ((Bt.settings.tilePush / 10) * 0.15)
                ),
                1 -
                    constrain(
                        (Tt.time - Tt.beat[i][8] - Tt.beat[i][1]) /
                            Tt.beat[i][6],
                        0,
                        1
                    )),
            $ =
                1 === Tt.beat[i][5]
                    ? constrain(
                          (Tt.edit ? Tt.time - Tt.beat[i][1] : Tt.beat[i][8]) /
                              Tt.beat[i][6],
                          0,
                          Tt.edit ? 1 : L
                      )
                    : 0,
            s = 1 !== Z ? lerp(c, f, b) / (f < c ? c : f) : 1,
            l = floor(width < height ? width : height) / 64 / s,
            L = lerp(
                Bt.settings.holdThickness,
                Bt.settings.holdProgressThickness,
                _
            );
        (beatBorderWidth = lerp(
            0.375 * l,
            6 * l,
            (Bt.settings.beatThickness - 1) / 9
        )),
            (holdBorderWidth = lerp(
                0.375 * l,
                6 * l,
                (Bt.settings.holdThickness - 1) / 9
            )),
            (progBorderWidth = lerp(0.375 * l, 6 * l, (L - 1) / 9));
        var C,
            ee,
            te,
            s =
                (s =
                    (g < d ? g - beatBorderWidth : d - beatBorderWidth) /
                    beatBorderWidth) < 0
                    ? 1 + s
                    : 1,
            l =
                (l =
                    (g < d ? g - holdBorderWidth : d - holdBorderWidth) /
                    holdBorderWidth) < 0
                    ? 1 + l
                    : 1,
            L =
                (L =
                    (g < d ? g - progBorderWidth : d - progBorderWidth) /
                    progBorderWidth) < 0
                    ? 1 + L
                    : 1,
            ie = s * beatBorderWidth,
            oe = holdBorderWidth * l,
            ne = progBorderWidth * L;
        switch (Tt.beat[i][5]) {
            default:
                !0 !== j
                    ? (strokeWeight(ie),
                      rectMode(CENTER),
                      (C = g - beatBorderWidth <= 1 ? 1 : g - beatBorderWidth),
                      (ee = d - beatBorderWidth <= 1 ? 1 : d - beatBorderWidth),
                      fill(
                          w,
                          J * _ * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1)
                      ),
                      noStroke(),
                      rect(0, 0, Math.max(C - ie, 0), Math.max(ee - ie, 0)),
                      noFill(),
                      stroke(
                          w,
                          G * _ * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1)
                      ),
                      rect(0, 0, C, ee),
                      -1 !== Tt.selectedBeats.indexOf(i) &&
                          (stroke(29, 255, 255),
                          rect(
                              0,
                              0,
                              (g - beatBorderWidth <= 1
                                  ? 1
                                  : g - beatBorderWidth) + ie,
                              (d - beatBorderWidth <= 1
                                  ? 1
                                  : d - beatBorderWidth) + ie
                          )))
                    : ((C = createGraphics(Ot(g), Ot(d), P2D)),
                      (ee = lerp(c, f, b) * g),
                      (se = lerp(u, v, b) * d),
                      0,
                      (y = ceil((Ot(g) - ee) / 2)),
                      (re = ceil((Ot(d) - se) / 2)),
                      (te = G * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1)),
                      C.rectMode(CORNER),
                      C.fill(
                          (Tt.beat[i][11] - lerp(3, 0, b)) % 255,
                          255,
                          255,
                          te
                      ),
                      C.rect(0, 0, y, Ot(d) - re),
                      C.fill(
                          (Tt.beat[i][11] - lerp(1, 0, b)) % 255,
                          255,
                          255,
                          te
                      ),
                      C.rect(0 + y, 0, Ot(g) - y, re),
                      C.fill(
                          (Tt.beat[i][11] + lerp(1, 0, b)) % 255,
                          255,
                          255,
                          te
                      ),
                      C.rect(0 + y + ee, 0 + re, y, Ot(d) - re),
                      C.fill(
                          (Tt.beat[i][11] + lerp(3, 0, b)) % 255,
                          255,
                          255,
                          te
                      ),
                      C.rect(0, 0 + re + se, Ot(g) - y, re),
                      image(C, -g / 2, -d / 2));
                break;
            case 1: {
                strokeWeight(oe),
                    noFill(),
                    rotate(Bt.settings.holdAngle),
                    scale(1 === Bt.settings.holdDirection ? -1 : 1, 1);
                const te = G * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1);
                var se = Y * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1),
                    y = lerp(te, se, _),
                    re = J * lerp(K, V, b) * constrain(lerp(m, p, b), 0, 1);
                let e = (Tt.time - Tt.beat[i][1]) / Tt.beat[i][6];
                var he = g - holdBorderWidth <= 1 ? 1 : g - holdBorderWidth,
                    ae = d - holdBorderWidth <= 1 ? 1 : d - holdBorderWidth,
                    le = g - progBorderWidth <= 1 ? 1 : g - progBorderWidth,
                    de = d - progBorderWidth <= 1 ? 1 : d - progBorderWidth,
                    ge =
                        ((e = constrain(e, 0, 1)) < $ && (e = $),
                        1 !== Z ? strokeCap(ROUND) : strokeCap(SQUARE),
                        color(
                            hue(w),
                            saturation(w),
                            lerp(
                                (brightness(w) / 255) * 200,
                                (brightness(w) / 255) * 100,
                                constrain(3 * $, 0, 1)
                            )
                        )),
                    ce = color(
                        hue(w),
                        saturation(w),
                        lerp(100, 255, brightness(w) / 255)
                    ),
                    ge = lerpColor(ce, ge, _),
                    fe =
                        (fill(ge, re),
                        noStroke(),
                        arc(0, 0, he - oe, ae - oe, -90, 270),
                        noFill(),
                        stroke(ge, te),
                        arc(0, 0, he, ae, 360 * e - 90, 270),
                        strokeCap(SQUARE),
                        push(),
                        strokeWeight(ne),
                        Tt.mods.hidden ? stroke(ce, y) : stroke(225, y),
                        arc(0, 0, le, de, -90, 360 * (e - $) - 90),
                        pop(),
                        push(),
                        strokeWeight(ne),
                        stroke(ce, y),
                        arc(0, 0, le, de, 360 * (e - $) - 90, 360 * e - 90),
                        pop(),
                        (Tt.beat[i][6] / 60) * Tt.beat[i][9]);
                strokeWeight(oe),
                    stroke(
                        (hue(w) + 239.0625) % 255,
                        saturation(w),
                        255,
                        te / 1.25
                    );
                for (var ue = 0; ue < fe; ue++) {
                    push();
                    var ve = (360 / fe) * ue - 90;
                    arc(0, 0, he, ae, ve - 5, 5 + ve), pop();
                }
                -1 !== Tt.selectedBeats.indexOf(i) &&
                    (stroke(29, 255, 255),
                    arc(0, 0, he + oe, ae + oe, -90, 270));
                break;
            }
        }
        pop();
    }
    colorMode(RGB),
        push(),
        rectMode(CENTER),
        width / 1920 > height / 1080
            ? translate(
                  width / 2 +
                      Tt.effected.boardX * (((1920 / 1080) * height) / 240),
                  height / 2 + Tt.effected.boardY * (height / 135)
              )
            : translate(
                  width / 2 + Tt.effected.boardX * (width / 240),
                  height / 2 + Tt.effected.boardY * ((0.5625 * width) / 135)
              ),
        scale(Tt.effected.boardW, Tt.effected.boardH),
        rotate(Tt.effected.boardR);
    for (
        var me = (Tt.board.w * Tt.board.c * 3) / 8,
            pe = (Tt.board.h * Tt.board.c * 3) / 8,
            be = width / 1920 > height / 1080,
            we = (kt / 4 / 5) * Bt.settings.missShake,
            i = 0;
        i < 9;
        i++
    )
        Tt.time - Tt.tileTrailLast[i] >=
            (Tt.effected.tileTrailSpacing[i] / 1e3 / 60) * 120 &&
            ((Tt.tileTrailLast[i] = Tt.time),
            void 0 === Tt.tileTrail[i] && (Tt.tileTrail[i] = []),
            push(),
            translate(me * ((i % 3) - 1), pe * (floor(i / 3) - 1)),
            be
                ? translate(
                      Tt.effected.tileX[i] * (((1920 / 1080) * height) / 240),
                      Tt.effected.tileY[i] * (height / 135)
                  )
                : translate(
                      Tt.effected.tileX[i] * (width / 240),
                      Tt.effected.tileY[i] * ((0.5625 * width) / 135)
                  ),
            Tt.tileTrail[i].push({
                time: Tt.time,
                x: zt.get(1).x,
                y: zt.get(1).y,
                r: Tt.effected.tileR[i],
                w: Tt.effected.tileW[i],
                h: Tt.effected.tileH[i],
                a: Tt.effected.tileA[i],
                hue: Tt.effected.tileColor[i],
                saturation: Tt.effected.tileSaturation[i],
                brightness: Tt.effected.tileBrightness[i],
                alpha: Tt.effected.tileAlpha[i],
                overlayHue: Tt.effected.tileOverlayColor[i],
                overlaySaturation: Tt.effected.tileOverlaySaturation[i],
                overlayBrightness: Tt.effected.tileOverlayBrightness[i],
                overlayAlpha: Tt.effected.tileOverlayAlpha[i],
                rememberColor: Tt.effected.tileTrailColor[i],
            }),
            10 < Tt.tileTrail[i].length &&
                (Tt.tileTrail[i] = Tt.tileTrail[i].splice(
                    Tt.tileTrail[i].length - 10,
                    10
                )),
            pop());
    for (i = 0; i < 9; i++) {
        var Ce = constrain(ceil(Tt.effected.tileTrailLength[i]), 0, 10),
            ye = constrain(Tt.effected.tileTrailLength[i], 0, 10) - Ce,
            Ee = {};
        Ee = be
            ? {
                  x:
                      Tt.effected.tileX[i] * (((1920 / 1080) * height) / 240) +
                      me * ((i % 3) - 1),
                  y:
                      Tt.effected.tileY[i] * (height / 135) +
                      pe * (floor(i / 3) - 1),
                  r: Tt.effected.tileR[i],
                  w: Tt.effected.tileW[i],
                  h: Tt.effected.tileH[i],
                  a: Tt.effected.tileA[i],
                  hue: Tt.effected.tileColor[i],
                  saturation: Tt.effected.tileSaturation[i],
                  brightness: Tt.effected.tileBrightness[i],
                  alpha: Tt.effected.tileAlpha[i],
                  overlayHue: Tt.effected.tileOverlayColor[i],
                  overlaySaturation: Tt.effected.tileOverlaySaturation[i],
                  overlayBrightness: Tt.effected.tileOverlayBrightness[i],
                  overlayAlpha: Tt.effected.tileOverlayAlpha[i],
                  rememberColor: !1,
              }
            : {
                  x: Tt.effected.tileX[i] * (width / 240) + me * ((i % 3) - 1),
                  y:
                      Tt.effected.tileY[i] * ((0.5625 * width) / 135) +
                      pe * (floor(i / 3) - 1),
                  r: Tt.effected.tileR[i],
                  w: Tt.effected.tileW[i],
                  h: Tt.effected.tileH[i],
                  a: Tt.effected.tileA[i],
                  hue: Tt.effected.tileColor[i],
                  saturation: Tt.effected.tileSaturation[i],
                  brightness: Tt.effected.tileBrightness[i],
                  alpha: Tt.effected.tileAlpha[i],
                  overlayHue: Tt.effected.tileOverlayColor[i],
                  overlaySaturation: Tt.effected.tileOverlaySaturation[i],
                  overlayBrightness: Tt.effected.tileOverlayBrightness[i],
                  overlayAlpha: Tt.effected.tileOverlayAlpha[i],
                  rememberColor: !1,
              };
        for (var Pe = Ce - 1; -1 <= Pe; Pe--) {
            if (0 <= Pe) {
                if (void 0 === Tt.tileTrail[i]) continue;
                var Oe = Tt.tileTrail[i].length - Pe - 1;
                if (void 0 === Tt.tileTrail[i][Oe]) continue;
                var E = Tt.tileTrail[i][Oe],
                    ze =
                        (1 -
                            lerp(
                                Pe,
                                Pe + 1,
                                (Tt.time - Tt.tileTrailLast[i]) /
                                    ((Tt.effected.tileTrailSpacing[i] /
                                        1e3 /
                                        60) *
                                        120)
                            ) /
                                (Ce + ye)) *
                        Tt.effected.tileTrailAlpha[i];
                if (
                    E.x === Ee.x &&
                    E.y === Ee.y &&
                    E.r === Ee.r &&
                    E.w === Ee.w &&
                    E.h === Ee.h
                )
                    continue;
                if (E.time < Tt.effected.tileTrailDelete[i]) continue;
            } else (E = Ee), (ze = 1);
            E.rememberColor ||
                ((E.hue = Tt.effected.tileColor[i]),
                (E.saturation = Tt.effected.tileSaturation[i]),
                (E.brightness = Tt.effected.tileBrightness[i]),
                (E.alpha = Tt.effected.tileAlpha[i]),
                (E.overlayHue = Tt.effected.tileOverlayColor[i]),
                (E.overlaySaturation = Tt.effected.tileOverlaySaturation[i]),
                (E.overlayBrightness = Tt.effected.tileOverlayBrightness[i]),
                (E.overlayAlpha = Tt.effected.tileOverlayAlpha[i])),
                (Tt.tilePressDis[i] += At(
                    Tt.tilePressRelease[i] ? 0 : 1,
                    Tt.tilePressDis[i],
                    0.4
                )),
                (Tt.tilePressDis[i] = Ot(1e4 * Tt.tilePressDis[i]) / 1e4),
                push(),
                strokeWeight(
                    Tt.board.str *
                        (Tt.board.c / 64) *
                        Tt.missTiles[i][0] *
                        (Tt.board.h < Tt.board.w
                            ? Tt.board.h / 0.75
                            : Tt.board.w / 0.75)
                ),
                colorMode(HSB),
                stroke(
                    E.hue,
                    E.saturation,
                    E.brightness,
                    E.alpha * Tt.effected.boardA * Tt.effected.tileA[i] * ze
                ),
                colorMode(RGB),
                translate(
                    sin((1 - Tt.missTiles[i][0]) * (8 * Math.PI)) * we,
                    0
                ),
                translate(E.x, E.y),
                rotate(E.r),
                scale(
                    1 -
                        Tt.tilePressDis[i] *
                            ((Bt.settings.tilePush / 10) * 0.15)
                ),
                fill(
                    0,
                    255 *
                        (1 - +Tt.board.str) *
                        Tt.effected.boardA *
                        Tt.effected.tileA[i]
                );
            var xe,
                Se =
                    ((Tt.board.w * Tt.board.c) / 4 +
                        Tt.board.str * (Tt.board.c / 64)) *
                    E.w,
                Be =
                    ((Tt.board.h * Tt.board.c) / 4 +
                        Tt.board.str * (Tt.board.c / 64)) *
                    E.h,
                Te =
                    (rect(0, 0, Se, Be),
                    (Bt.settings.boardOverlay / 100) *
                        Tt.effected.boardA *
                        E.a);
            0 < Te &&
                ((xe =
                    2 !==
                    (!(xe = []) === Bt.settings.overlayText
                        ? Bt.settings.keyboard
                        : Bt.settings.overlayText)
                        ? Tt.keyDisplay[Bt.settings.language]
                        : Tt.keyDisplayNum),
                textAlign(CENTER, CENTER),
                colorMode(HSB),
                fill(
                    E.overlayHue,
                    E.overlaySaturation,
                    E.overlayBrightness,
                    E.overlayAlpha * Te * ze
                ),
                noStroke(),
                textSize((Se < Be ? Se : Be) / 1.5),
                text(xe[i], 0, 0)),
                pop();
        }
    }
    pop();
    (o = 0), (n = 0);
    n =
        width / 1920 > height / 1080
            ? ((o = ((1920 / 1080) * height) / 240), height / 135)
            : ((o = width / 240), (0.5625 * width) / 135);
    for (var i = Tt.newHits.length - 1; 0 <= i; i--) {
        var He,
            Re,
            ke,
            Ne,
            P = Tt.newHits[i],
            Qe = Tt.hitValues[P.type],
            b =
                (Tt.time - P.time) /
                ((Bt.settings.hitParticlesDuration / 240) * Tt.mods.bpm);
        (0 === P.type && Bt.settings.disableMarvelouses) ||
            (1 === P.type && Bt.settings.disableGreats) ||
            (2 === P.type && Bt.settings.disableGoods) ||
            (3 === P.type && Bt.settings.disableOks) ||
            (4 === P.type && Bt.settings.disableMisses) ||
            (b < 1 &&
                ((He =
                    ((Tt.board.w * Tt.board.c * 3) / 8) * ((P.tile % 3) - 1) +
                    width / 2 +
                    Tt.effected.tileX[P.tile] * o),
                (ke =
                    ((Tt.board.h * Tt.board.c * 3) / 8) *
                        (floor(P.tile / 3) - 1) +
                    height / 2 +
                    Tt.effected.tileY[P.tile] * n),
                (Re =
                    ((Tt.board.w * Tt.board.c) / 4) *
                    (1 - abs(P.error)) *
                    Tt.effected.tileW[P.tile]),
                (Ne =
                    ((Tt.board.h * Tt.board.c) / 4) *
                    (1 - abs(P.error)) *
                    Tt.effected.tileH[P.tile]),
                push(),
                rectMode(CENTER),
                translate(width / 2, height / 2),
                translate(Tt.effected.boardX * o, Tt.effected.boardY * n),
                scale(Tt.effected.boardW, Tt.effected.boardH),
                rotate(Tt.effected.boardR),
                translate(-width / 2, -height / 2),
                translate(He, ke),
                rotate(Tt.effected.tileR[P.tile]),
                push(),
                (He =
                    ((Re < Ne ? Re : Ne) / 3) *
                    (Bt.settings.hitParticlesThickness / 5)),
                (ke = 0.5 * sin(90 * b) + 1),
                (ke =
                    (Re + He / 4) *
                    (Re = lerp(
                        ke,
                        lerp(ke / 1.5, ke, Bt.settings.hitParticlesSpread / 5),
                        b
                    ))),
                (Ne = (Ne + He / 4) * Re),
                stroke(Qe.color),
                (drawingContext.globalAlpha =
                    (0.25 + 0.75 * (1 - b)) *
                    (Bt.settings.hitParticlesOpacity / 100)),
                strokeWeight(He * (1 - b)),
                noFill(),
                rectMode(CENTER),
                ellipseMode(CENTER),
                (1 === P.noteType ? ellipse : rect)(0, 0, ke, Ne),
                pop(),
                pop()));
    }
    colorMode(HSB),
        fill(
            Tt.effected.foregroundOverlayColor,
            Tt.effected.foregroundOverlaySaturation,
            Tt.effected.foregroundOverlayBrightness,
            Tt.effected.foregroundOverlayAlpha
        ),
        noStroke(),
        rect(0, 0, width, height),
        colorMode(RGB),
        push(),
        imageMode(CENTER),
        translate(width / 2, height / 2),
        image(
            St.vignette,
            0,
            0,
            (width / 1920 > height / 1080 ? (1920 / 1080) * height : width) *
                (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) + 1) +
                8,
            (width / 1920 > height / 1080 ? height : 0.5625 * width) *
                (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) + 1) +
                8
        ),
        resetMatrix(),
        rectMode(CORNER),
        fill(0),
        noStroke(),
        rect(
            0,
            0,
            width,
            (height -
                (width / 1920 > height / 1080 ? height : 0.5625 * width) *
                    (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) +
                        1)) /
                2
        ),
        rect(
            0,
            height,
            width,
            -(
                height -
                (width / 1920 > height / 1080 ? height : 0.5625 * width) *
                    (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) + 1)
            ) / 2
        ),
        rect(
            0,
            0,
            (width -
                (width / 1920 > height / 1080
                    ? (1920 / 1080) * height
                    : width) *
                    (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) +
                        1)) /
                2,
            height
        ),
        rect(
            width,
            0,
            -(
                width -
                (width / 1920 > height / 1080
                    ? (1920 / 1080) * height
                    : width) *
                    (-pow(Tt.effected.vignette - 10, 3) / (pow(10, 3) / 14) + 1)
            ) / 2,
            height
        ),
        pop(),
        push(),
        resetMatrix(),
        fill(0),
        rectMode(CORNER),
        noStroke(),
        (H =
            width / 1920 > height / 1080
                ? ((R = ((1920 / 1080) * height) / 240),
                  (N = height / 135),
                  (T = width - (1920 / 1080) * height),
                  0)
                : ((R = width / 240),
                  (N = (0.5625 * width) / 135),
                  (T = 0),
                  height - 0.5625 * width)),
        rect(0, 0, T / 2 + Tt.effected.letterboxX * R, height),
        rect(width, 0, -T / 2 - Tt.effected.letterboxX * R, height),
        rect(0, 0, width, H / 2 + Tt.effected.letterboxY * N),
        rect(0, height, width, -H / 2 - Tt.effected.letterboxY * N),
        pop();
    for (i = 0; i < Tt.effected.subtitles.length; i++) {
        var Ie,
            Ae,
            Fe,
            De,
            Xe,
            O = Tt.effected.subtitles[i],
            We =
                (push(),
                (O.moveX = void 0 === O.moveX ? 0 : O.moveX),
                (O.moveY = void 0 === O.moveY ? 0 : O.moveY),
                (O.moveSize = void 0 === O.moveSize ? 0 : O.moveSize),
                (O.posD = void 0 === O.posD ? 0 : O.posD),
                (O.moveD = void 0 === O.moveD ? 0 : O.moveD),
                (O.moveHighlightColor =
                    void 0 === O.moveHighlightColor ? 0 : O.moveHighlightColor),
                (O.transparency =
                    void 0 === O.transparency ? 255 : O.transparency),
                (O.moveTransparency =
                    void 0 === O.moveTransparency ? 0 : O.moveTransparency),
                (O.easeType = void 0 === O.easeType ? 0 : O.easeType),
                (O.textDi = void 0 === O.textDi ? 0 : O.textDi),
                O.posX + It(Tt.time - O.time, O.moveTime, O.moveX, O.easeType)),
            Ue = O.posY + It(Tt.time - O.time, O.moveTime, O.moveY, O.easeType),
            Le =
                O.size +
                It(Tt.time - O.time, O.moveTime, O.moveSize, O.easeType),
            Ke = O.posD + It(Tt.time - O.time, O.moveTime, O.moveD, O.easeType),
            z = O.highlightColor,
            Ve = O.highlightSaturation,
            Me = O.highlightBrightness,
            qe = O.highlightAlpha,
            x = O.backgroundColor,
            Ze = O.backgroundSaturation,
            je = O.backgroundBrightness,
            Ge = O.backgroundAlpha,
            S =
                ((z = (z %= 255) < 0 ? 255 + z : z),
                (x = (x %= 255) < 0 ? 255 + x : x),
                (Le = Le < 0 ? 0 : Le),
                It(Tt.time - O.time, O.moveTime, 1, O.easeType)),
            S =
                (colorMode(HSB),
                (qe =
                    !0 === O.targetHighlightSmooth
                        ? (colorMode(HSB),
                          (Ie = color(z, Ve, Me, qe)),
                          (Ae = color(
                              O.targetHighlightColor,
                              O.targetHighlightSaturation,
                              O.targetHighlightBrightness,
                              O.targetHighlightAlpha
                          )),
                          colorMode(RGB),
                          (Fe = lerpColor(Ie, Ae, S)),
                          (z = hue(Fe)),
                          (Ve = saturation(Fe)),
                          (Me = brightness(Fe)),
                          alpha(Fe))
                        : (void (De = 0) !== O.targetHighlightLoops &&
                              (De = 255 * O.targetHighlightLoops),
                          (z =
                              (z =
                                  lerp(z, O.targetHighlightColor + De, S) %
                                  255) < 0
                                  ? 255 + z
                                  : z),
                          (Ve = lerp(Ve, O.targetHighlightSaturation, S)),
                          (Me = lerp(Me, O.targetHighlightBrightness, S)),
                          lerp(qe, O.targetHighlightAlpha, S))),
                (Ge =
                    !0 === O.targetBackgroundSmooth
                        ? (colorMode(HSB),
                          (Ie = color(x, Ze, je, Ge)),
                          (Ae = color(
                              O.targetBackgroundColor,
                              O.targetBackgroundSaturation,
                              O.targetBackgroundBrightness,
                              O.targetBackgroundAlpha
                          )),
                          colorMode(RGB),
                          (Fe = lerpColor(Ie, Ae, S)),
                          (x = hue(Fe)),
                          (Ze = saturation(Fe)),
                          (je = brightness(Fe)),
                          alpha(Fe))
                        : (void (De = 0) !== O.targetBackgroundLoops &&
                              (De = 255 * O.targetBackgroundLoops),
                          (x =
                              (x =
                                  lerp(x, O.targetBackgroundColor + De, S) %
                                  255) < 0
                                  ? 255 + x
                                  : x),
                          (Ze = lerp(Ze, O.targetBackgroundSaturation, S)),
                          (je = lerp(je, O.targetBackgroundBrightness, S)),
                          lerp(Ge, O.targetBackgroundAlpha, S))),
                colorMode(HSB),
                0),
            Ye = 0;
        if (
            (isNaN(z) && (z = 141),
            isNaN(x) && (z = 141),
            (Ye =
                (width / 1920 > height / 1080
                    ? (translate(
                          We * (((1920 / 1080) * height) / 240) +
                              (width - (1920 / 1080) * height) / 2,
                          Ue * (height / 135)
                      ),
                      (S = Ot(Le * (height / 135))),
                      ((1920 / 1080) * height) / 240)
                    : (translate(
                          We * (width / 240),
                          Ue * ((0.5625 * width) / 135) +
                              (height - 0.5625 * width) / 2
                      ),
                      (S = Ot(Le * ((0.5625 * width) / 135))),
                      width / 240),
                S)),
            textSize(S),
            textLeading(Ye),
            rotate(Ke),
            void 0 !== O.text)
        ) {
            var B = O.text,
                Je = O.highlight,
                _e = !1,
                $e = !1;
            switch (O.textDi) {
                case 1:
                    (B = (B = (B = B.split("")).reverse()).join("")), ($e = !0);
                    break;
                case 2:
                    (B = (B = B.split("")).join("\n")), (Je *= 2), (_e = !0);
                    break;
                case 3:
                    (B = (B = (B = B.split("")).reverse()).join("\n")),
                        (Je *= 2),
                        ($e = _e = !0);
            }
            if (((Xe = Di(B, S, Ye)), _e))
                switch (Tt.effected.subtitles[i].textAl) {
                    default:
                        textAlign(LEFT, TOP);
                        break;
                    case 1:
                        textAlign(CENTER, TOP);
                        break;
                    case 2:
                        textAlign(RIGHT, TOP);
                        break;
                    case 3:
                        textAlign(LEFT, TOP), translate(0, Ot(-Xe / 2));
                        break;
                    case 4:
                        textAlign(CENTER, TOP), translate(0, Ot(-Xe / 2));
                        break;
                    case 5:
                        textAlign(RIGHT, TOP), translate(0, Ot(-Xe / 2));
                        break;
                    case 6:
                        textAlign(LEFT, TOP), translate(0, Ot(-Xe));
                        break;
                    case 7:
                        textAlign(CENTER, TOP), translate(0, Ot(-Xe));
                        break;
                    case 8:
                        textAlign(RIGHT, TOP), translate(0, Ot(-Xe));
                }
            else
                switch (Tt.effected.subtitles[i].textAl) {
                    default:
                        textAlign(LEFT, TOP), translate(0, 0);
                        break;
                    case 1:
                        textAlign(LEFT, TOP),
                            translate(
                                Ot(
                                    -textWidth(Tt.effected.subtitles[i].text) /
                                        2
                                ),
                                0
                            );
                        break;
                    case 2:
                        textAlign(LEFT, TOP),
                            translate(
                                Ot(-textWidth(Tt.effected.subtitles[i].text)),
                                0
                            );
                        break;
                    case 3:
                        textAlign(LEFT, CENTER);
                        break;
                    case 4:
                        textAlign(LEFT, CENTER),
                            translate(
                                Ot(
                                    -textWidth(Tt.effected.subtitles[i].text) /
                                        2
                                ),
                                0
                            );
                        break;
                    case 5:
                        textAlign(LEFT, CENTER),
                            translate(
                                Ot(-textWidth(Tt.effected.subtitles[i].text)),
                                0
                            );
                        break;
                    case 6:
                        textAlign(LEFT, BOTTOM);
                        break;
                    case 7:
                        textAlign(LEFT, BOTTOM),
                            translate(
                                Ot(
                                    -textWidth(Tt.effected.subtitles[i].text) /
                                        2
                                ),
                                0
                            );
                        break;
                    case 8:
                        textAlign(LEFT, BOTTOM),
                            translate(
                                Ot(-textWidth(Tt.effected.subtitles[i].text)),
                                0
                            );
                }
            $e &&
                (Je = abs(
                    B.length -
                        (constrain(Je, 0, B.length + (_e ? 1 : 0)) -
                            (_e ? 1 : 0))
                )),
                (Je = constrain(Je, 0, B.length)),
                colorMode(HSB);
            (We = color(x, Ze, je, Ge)),
                (Ue = color(z, Ve, Me, qe)),
                (Le =
                    (fill($e ? Ue : We),
                    _e ? Ot(Di(B.substr(0, Je), S, Ye)) : 0));
            text(
                B.substr(Je, B.length),
                _e ? 0 : Ot(textWidth(B.substr(0, Je))),
                0 < Le ? Le + Ye / 2 - textDescent() : 0
            ),
                fill($e ? We : Ue),
                text(B.substr(0, Je), 0, 0);
        }
        pop(), colorMode(RGB);
    }
    if (
        (Tt.mods.flashlight &&
            (push(),
            width / 1920 > height / 1080
                ? translate(
                      width / 2 +
                          Tt.effected.boardX * (((1920 / 1080) * height) / 240),
                      height / 2 + Tt.effected.boardY * (height / 135)
                  )
                : translate(
                      width / 2 + Tt.effected.boardX * (width / 240),
                      height / 2 + Tt.effected.boardY * ((0.5625 * width) / 135)
                  ),
            rotate(Tt.effected.boardR),
            scale(Tt.effected.boardW, Tt.effected.boardH),
            (Tt.flashlightX += At(
                ((Tt.board.w * Tt.board.c * 3) / 8) *
                    ((Tt.lastHitTile % 3) - 1),
                Tt.flashlightX,
                0.2
            )),
            (Tt.flashlightY += At(
                ((Tt.board.h * Tt.board.c * 3) / 8) *
                    (floor(Tt.lastHitTile / 3) - 1),
                Tt.flashlightY,
                0.2
            )),
            translate(Tt.flashlightX, Tt.flashlightY),
            width / 1920 > height / 1080
                ? translate(
                      Tt.effected.tileX[Tt.lastHitTile] *
                          (((1920 / 1080) * height) / 240),
                      Tt.effected.tileY[Tt.lastHitTile] * (height / 135)
                  )
                : translate(
                      Tt.effected.tileX[Tt.lastHitTile] * (width / 240),
                      Tt.effected.tileY[Tt.lastHitTile] *
                          ((0.5625 * width) / 135)
                  ),
            noFill(),
            stroke(0),
            strokeWeight(width),
            ellipse(
                0,
                0,
                ((Tt.board.w * Tt.board.c) / 4) *
                    Tt.effected.tileW[Tt.lastHitTile] *
                    4 +
                    width,
                ((Tt.board.h * Tt.board.c) / 4) *
                    Tt.effected.tileH[Tt.lastHitTile] *
                    4 +
                    width,
                Tt.flashlightY
            ),
            pop()),
        push(),
        resetMatrix(),
        fill(0),
        rectMode(CORNER),
        noStroke(),
        width / 1920 > height / 1080
            ? (rect(0, 0, (width - (1920 / 1080) * height) / 2, height),
              rect(
                  width,
                  height,
                  -(width - (1920 / 1080) * height) / 2,
                  -height
              ))
            : height / 1080 > width / 1920 &&
              (rect(0, 0, width, (height - 0.5625 * width) / 2),
              rect(width, height, -width, -(height - 0.5625 * width) / 2)),
        pop(),
        !1 === Tt.edit)
    ) {
        (Tt.headerY += At(0, Tt.headerY, 0.2)),
            Tt.showGUI
                ? (Tt.guiAlpha += At(1, Tt.guiAlpha, 0.3))
                : (Tt.guiAlpha += At(0, Tt.guiAlpha, 0.3)),
            rectMode(CORNER),
            noStroke();
        for (
            var T = Ot(
                    lerp(
                        width / 16,
                        width / 2,
                        (Bt.settings.headerWidth - 1) / 9
                    )
                ),
                et =
                    (push(),
                    translate(width / 2 - T / 2, 0),
                    Bt.settings.showProgress
                        ? ((R = Ot(constrain(Tt.time / Tt.timeEnd, 0, 1) * T)),
                          fill(40, 150 * Tt.guiAlpha),
                          rect(R, 0, T - R, height / 32),
                          fill(150, 150 * Tt.guiAlpha),
                          rect(0, 0, R, height / 32))
                        : (Bt.settings.showAccuracy || Bt.settings.showHP) &&
                          (fill(40, 150 * Tt.guiAlpha),
                          rect(0, 0, T, height / 32)),
                    pop(),
                    0),
                i = (Tt.acc = 0);
            i < Tt.hitValues.length;
            i++
        )
            isNaN(Tt.hitStats[i]) && (Tt.hitStats[i] = 0),
                (Tt.acc += Tt.hitValues[i].acc * Tt.hitStats[i]),
                (et += Tt.hitStats[i]);
        0 < et ? (Tt.acc /= et) : (Tt.acc = 100),
            (Tt.accDis += At(Tt.acc, Tt.accDis, 0.35)),
            (Tt.scoreFinal = Gi(Tt.newScore.log)),
            (Tt.scoreDis += At(
                Tt.scoreFinal * wn(Tt.mods, !0),
                Tt.scoreDis,
                0.35
            ));
        var H = Tt.accDis.toFixed(3) + "%";
        if (
            (Bt.settings.showAccuracy &&
                (textAlign(CENTER, CENTER),
                fill(255, 200 * Tt.guiAlpha),
                textSize(height / 32 / 1.5),
                text(H, width / 2, height / 32 / 2)),
            (Tt.hp = constrain(Tt.hp, 0, 100)),
            (Tt.hpDis += At(Tt.hp, Tt.hpDis, 0.2)),
            Bt.settings.showHP &&
                ((N = pow(Tt.hpDis / 100, 1)),
                fill(
                    lerpColor(
                        color(255, 0, 0, 200 * Tt.guiAlpha),
                        color(255, 200 * Tt.guiAlpha),
                        N
                    )
                ),
                rect(
                    width / 2 - T / 2,
                    height / 32,
                    T * (Tt.hpDis / 100),
                    lerp(height / 64, height / 512, N)
                )),
            Bt.settings.showUR)
        ) {
            push(), translate(width / 2, (height / 32) * 2), rectMode(CENTER);
            for (i = Tt.newHits.length - 1; 0 <= i; i--) {
                var P = Tt.newHits[i],
                    Qe = Tt.hitValues[P.type];
                1 <= (Tt.time - P.time) / 5 && Tt.newHits.splice(i, 1),
                    fill(
                        Qe.color,
                        lerp(200 * Tt.guiAlpha, 0, (Tt.time - P.time) / 5)
                    ),
                    rect(
                        (P.error /
                            Tt.hitValues[Tt.hitValues.length - 1].timing) *
                            (width / 16 / 2),
                        0,
                        width / 1024,
                        height / 64
                    );
            }
            pop();
        }
        textAlign(CENTER, CENTER),
            Bt.settings.showJudgements &&
                0 < Tt.newHits.length &&
                ((P = Tt.newHits[Tt.newHits.length - 1]),
                (Qe = Tt.hitValues[P.type]),
                fill(
                    Qe.color,
                    lerp(200 * Tt.guiAlpha, 0, (Tt.time - P.time) / 5)
                ),
                textSize(
                    lerp(
                        (height / 64) * 1.25,
                        height / 64,
                        constrain((Tt.time - P.time) / 3, 0, 1)
                    )
                ),
                text(Qe.name, width / 2, (height / 32) * 1.5));
        var R = "";
        if (
            (Tt.mods.auto
                ? (R = Pt(
                      "game_replayHeader",
                      xt,
                      "Pulsus",
                      Tt.title,
                      void 0 === Ut(Tt.author, "uuid").user
                          ? Pt("defaultUsername", xt)
                          : Ut(Tt.author, "uuid").user,
                      Ot(100 * Tt.stars) / 100,
                      Vo(Tt.mods)
                  ))
                : 0 !== Tt.mods.startPos || 0 !== Tt.mods.endPos
                ? (R = Pt(
                      "game_practicing",
                      xt,
                      Ko(Tt.mods.startPos, Tt.mods.endPos)
                  ))
                : Tt.replay.on &&
                  (R = Pt(
                      "game_replayHeader",
                      xt,
                      Ut(Tt.replay.user, "uuid").user,
                      Tt.title,
                      void 0 === Ut(Tt.author, "uuid").user
                          ? Pt("defaultUsername", xt)
                          : Ut(Tt.author, "uuid").user,
                      Ot(100 * Tt.stars) / 100,
                      Vo(Tt.mods)
                  )),
            0 < R.length &&
                (textSize(height / 32 / 1.5),
                rectMode(CENTER),
                fill(40, 150 * Tt.guiAlpha),
                rect(
                    width / 2,
                    height - height / 32 / 2,
                    textWidth(R) + (height / 32 - height / 32 / 1.5),
                    height / 32
                ),
                textAlign(CENTER, CENTER),
                fill(255, 200 * Tt.guiAlpha),
                text(R, width / 2, height - height / 32 / 2)),
            Bt.settings.showScore &&
                (textAlign(RIGHT, TOP),
                fill(255, 200 * Tt.guiAlpha),
                textSize(height / 16 / 1.5),
                text(Ot(Tt.scoreDis), width - height / 32, height / 32)),
            Bt.settings.showCombo &&
                (textAlign(LEFT, BOTTOM),
                fill(255, 200 * Tt.guiAlpha),
                0 < Tt.newHits.length
                    ? ((P = Tt.newHits[Tt.newHits.length - 1]),
                      textSize(
                          lerp(
                              height / 16,
                              height / 16 / 1.5,
                              Math.sin(
                                  (constrain(Tt.time - P.time, 0, 1) *
                                      Math.PI) /
                                      2
                              )
                          )
                      ))
                    : textSize(height / 16 / 1.5),
                text(Tt.combo + "x", height / 32, height - height / 32)),
            Bt.settings.showSections && 0 <= Tt.sections.length)
        ) {
            rectMode(CORNER);
            for (var tt = !1, i = Tt.sections.length - 1; 0 <= i; i--) {
                var it = Tt.sections[i];
                if (Tt.time > it.time) {
                    tt = i;
                    break;
                }
            }
            textAlign(LEFT, CENTER);
            for (
                var H = height / 24,
                    T = (textSize(H / 1.5), 0),
                    ot =
                        (!1 !== tt
                            ? ((N = Tt.sections[tt]),
                              (Tt.sectionBarWidth += At(
                                  textWidth(N.name) + (H - H / 1.5),
                                  Tt.sectionBarWidth,
                                  0.2
                              )),
                              (Tt.sectionCarouselIndex += At(
                                  tt + 1,
                                  Tt.sectionCarouselIndex,
                                  0.2
                              )),
                              (T = Ot(
                                  constrain(
                                      (Tt.time - N.time) /
                                          ((tt === Tt.sections.length - 1
                                              ? Tt.timeEnd
                                              : Tt.sections[tt + 1].time) -
                                              N.time),
                                      0,
                                      1
                                  ) * Tt.sectionBarWidth
                              )))
                            : ((Tt.sectionBarWidth += At(
                                  0,
                                  Tt.sectionBarWidth,
                                  0.2
                              )),
                              (Tt.sectionCarouselIndex += At(
                                  0,
                                  Tt.sectionCarouselIndex,
                                  0.2
                              ))),
                        [""]),
                    i = 0;
                i < Tt.sections.length;
                i++
            )
                ot.push({
                    text: Tt.sections[i].name,
                    color: color(255, 200 * Tt.guiAlpha),
                });
            fill(40, 150 * Tt.guiAlpha),
                rect(T + kt, kt, Ot(Tt.sectionBarWidth) - T, H),
                fill(150, 150 * Tt.guiAlpha),
                rect(kt, kt, T, H),
                Un(
                    (H - H / 1.5) / 2 + kt,
                    H / 2 + kt,
                    H / 1.5,
                    1,
                    Tt.sectionCarouselIndex,
                    ot
                );
        }
        // --- EDITED CODE (Show multiplayer scores in game)
        (tempUserDraw = Object.values(multiplayer.roomUsers).sort(
            compareScore
        )),
            tempUserDraw.forEach((user, index) => {
                user.draw(
                    kt / 16,
                    height / 2 -
                        (Object.keys(multiplayer.roomUsers).length * width) /
                            46 +
                        index * (width / 23),
                    width / 6
                );
            });
    }
    if (!0 === Tt.edit) {
        var k = Fn();
        if ((0 === Tt.editorMode && (Tt.showGUI = !0), Tt.showGUI)) {
            Tt.headerY += At(0, Tt.headerY, 0.2);
            var nt = Ft("rcorner", 0, 0, kt, kt),
                R =
                    (mouseY <
                        (height / 16) * Tt.headerY +
                            (height / 16) * (Tt.headerH + 1) &&
                    "scroll" === Tt.timelineMode &&
                    !Tt.menu &&
                    !nt
                        ? ((Tt.headerH += At(1, Tt.headerH, 0.2)),
                          mouseIsPressed &&
                              ((Tt.time =
                                  Ot((Tt.timeEnd / width) * mouseX * 4 * e) /
                                      4 /
                                      e +
                                  (Tt.bpm / 60 / 1e3) * Tt.timelineOffset),
                              (Tt.timeScroll = Tt.time),
                              !0 === Tt.playing) &&
                              ((Tt.timeStart = millis()),
                              (Tt.playingOffset = Tt.time),
                              Qt[Tt.song].seek(
                                  ((Tt.playingOffset / Tt.bpm) * 60 * 1e3 +
                                      Tt.songOffset) /
                                      1e3,
                                  $o
                              ),
                              (Tt.editorHS = []),
                              (Tt.editorHSH = []),
                              (Tt.editorHSStart = !1),
                              (Tt.metronomeLast = !1)))
                        : ((Tt.headerH += At(0, Tt.headerH, 0.1)),
                          (Tt.toolsH += At(0, Tt.toolsH, 0.1))),
                    noStroke(),
                    fill(0, 200),
                    rectMode(CORNER),
                    rect(
                        0,
                        (height / 16) * Tt.headerY,
                        width,
                        lerp(
                            height / 16 +
                                (1 === Tt.editorMode ? (k * height) / 24 : 0),
                            (height / 16) * 2,
                            Tt.headerH
                        )
                    ),
                    4);
            0.25 !== Tt.snap &&
                Tt.snap !== 1 / 8 &&
                Tt.snap !== 1 / 16 &&
                (R = 3),
                push(),
                strokeWeight((width < height ? width : height) / 512),
                translate(
                    -(
                        (width / 32) *
                        ((((Tt.time - (Tt.bpm / 60 / 1e3) * Tt.timelineOffset) *
                            e) /
                            Tt.snap) %
                            (8 * R))
                    ),
                    0
                );
            for (i = 0; i < 64; i++)
                0.25 === Tt.snap || Tt.snap === 1 / 8 || Tt.snap === 1 / 16
                    ? i % ((0.25 / Tt.snap) * 4) == 0
                        ? (stroke(0, 175, 255, 255 * (1 - Tt.headerH)),
                          line(
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 +
                                  (height / 24) * (1 === Tt.editorMode ? k : 0),
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 -
                                  height / 16 / 2
                          ))
                        : i % ((0.25 / Tt.snap) * 2) == 0
                        ? (stroke(0, 255, 0, 255 * (1 - Tt.headerH)),
                          line(
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 +
                                  (height / 24) * (1 === Tt.editorMode ? k : 0),
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 -
                                  height / 16 / 3
                          ))
                        : i % ((0.25 / Tt.snap) * 1) == 0
                        ? (stroke(255, 175, 0, 255 * (1 - Tt.headerH)),
                          line(
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 +
                                  (height / 24) * (1 === Tt.editorMode ? k : 0),
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 -
                                  height / 16 / 4
                          ))
                        : i % ((0.25 / Tt.snap) * 0.5) == 0 && Tt.snap <= 1 / 8
                        ? (stroke(255, 0, 175, 255 * (1 - Tt.headerH)),
                          line(
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 +
                                  (height / 24) * (1 === Tt.editorMode ? k : 0),
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 -
                                  height / 16 / 5
                          ))
                        : i % ((0.25 / Tt.snap) * 0.25) == 0 &&
                          Tt.snap <= 1 / 16 &&
                          (stroke(255, 255, 0, 255 * (1 - Tt.headerH)),
                          line(
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 +
                                  (height / 24) * (1 === Tt.editorMode ? k : 0),
                              (width / 32) * i,
                              (height / 16) * Tt.headerY +
                                  height / 16 -
                                  height / 16 / 6
                          ))
                    : (i - 4) % ((1 / Tt.snap / 3) * 3) == 0
                    ? (stroke(0, 175, 255, 255 * (1 - Tt.headerH)),
                      line(
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 +
                              (height / 24) * (1 === Tt.editorMode ? k : 0),
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 -
                              height / 16 / 2
                      ))
                    : (i - 4) % ((1 / Tt.snap / 3) * 3) ==
                          (1 / Tt.snap / 3) * 1 ||
                      (i - 4) % ((1 / Tt.snap / 3) * 3) == (1 / Tt.snap / 3) * 2
                    ? (stroke(255, 0, 0, 255 * (1 - Tt.headerH)),
                      line(
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 +
                              (height / 24) * (1 === Tt.editorMode ? k : 0),
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 -
                              height / 16 / 3
                      ))
                    : (i - 4) % (((1 / Tt.snap / 3) * 3) / 6) == 0 ||
                      (i - 4) % (((1 / Tt.snap / 3) * 3) / 6) == 0
                    ? (stroke(255, 255, 255, 255 * (1 - Tt.headerH)),
                      line(
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 +
                              (height / 24) * (1 === Tt.editorMode ? k : 0),
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 -
                              height / 16 / 4
                      ))
                    : (stroke(0, 0, 255, 255 * (1 - Tt.headerH)),
                      line(
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 +
                              (height / 24) * (1 === Tt.editorMode ? k : 0),
                          (width / 32) * i,
                          (height / 16) * Tt.headerY +
                              height / 16 -
                              height / 16 / 6
                      ));
            if (
                (pop(),
                push(),
                translate(
                    width / 2 - (width / 32) * ((Tt.time * e) / Tt.snap),
                    0
                ),
                0 === Tt.editorMode)
            ) {
                for (var st = [], rt = [], i = 0; i < Tt.beat.length; i++)
                    -1 === st.indexOf(Tt.beat[i][1]) &&
                        (st.push(Tt.beat[i][1]), rt.push(i));
                for (i = 0; i < Tt.beat.length; i++)
                    (width / 32) *
                        ((Tt.beat[i][1] +
                            (1 === Tt.beat[i][5] ? Tt.beat[i][6] : 0)) *
                            e) *
                        (1 / Tt.snap) +
                        (width / 2 - (width / 32) * ((Tt.time * e) / Tt.snap)) >
                        0 - kt &&
                        (width / 32) * (Tt.beat[i][1] * e) * (1 / Tt.snap) +
                            (width / 2 -
                                (width / 32) * ((Tt.time * e) / Tt.snap)) <
                            width + kt &&
                        (rectMode(CENTER),
                        noStroke(),
                        (pt = !0),
                        (pt = -1 === rt.indexOf(i) ? !1 : pt) &&
                            (fill(255, 30 * (1 - Tt.headerH)),
                            rect(
                                (width / 32) *
                                    (Tt.beat[i][1] * e) *
                                    (1 / Tt.snap),
                                (height / 16) * Tt.headerY +
                                    height / 16 -
                                    height / 16 / 2,
                                3 * Ot(floor(width / 36) / 3),
                                3 * Ot(floor(width / 36) / 3)
                            )),
                        colorMode(HSB),
                        fill(
                            Tt.beat[i][11],
                            Tt.beat[i][16],
                            Tt.beat[i][17],
                            125 * (1 - Tt.headerH)
                        ),
                        colorMode(RGB),
                        -1 !== Tt.selectedBeats.indexOf(i) &&
                            (stroke(255, 175, 0), strokeWeight(kt / 8)),
                        0 === Tt.beat[i][5]
                            ? rect(
                                  (width / 32) *
                                      (Tt.beat[i][1] * e) *
                                      (1 / Tt.snap) -
                                      floor(width / 36) / 3 +
                                      Ot(floor(width / 36) / 3) *
                                          floor(Tt.beat[i][0] % 3),
                                  (height / 16) * Tt.headerY +
                                      height / 16 -
                                      height / 16 / 2 -
                                      floor(width / 36) / 3 +
                                      Ot(floor(width / 36) / 3) *
                                          floor(Tt.beat[i][0] / 3),
                                  floor(width / 48) / 3,
                                  floor(width / 48) / 3
                              )
                            : (ellipseMode(CENTER),
                              ellipse(
                                  (width / 32) *
                                      (Tt.beat[i][1] * e) *
                                      (1 / Tt.snap) -
                                      floor(width / 36) / 3 +
                                      Ot(floor(width / 36) / 3) *
                                          floor(Tt.beat[i][0] % 3),
                                  (height / 16) * Tt.headerY +
                                      height / 16 -
                                      height / 16 / 2 -
                                      floor(width / 36) / 3 +
                                      Ot(floor(width / 36) / 3) *
                                          floor(Tt.beat[i][0] / 3),
                                  floor(width / 48) / 3,
                                  floor(width / 48) / 3
                              ),
                              rectMode(CORNER),
                              rect(
                                  (width / 32) *
                                      (Tt.beat[i][1] * e) *
                                      (1 / Tt.snap),
                                  (height / 16) * Tt.headerY +
                                      height / 16 -
                                      height / 16 / 2 -
                                      height / 256 / 2,
                                  (width / 32) *
                                      ((Tt.beat[i][6] / Tt.snap) * e),
                                  height / 256
                              )));
            }
            if (1 === Tt.editorMode && Tt.showGUI)
                for (t = 0; t < Tt.drawEffects.length; t++) {
                    var i = Tt.drawEffects[t],
                        ht =
                            (rectMode(CENTER),
                            noStroke(),
                            colorMode(HSB),
                            fill(
                                0 < Tt.effects[i].displayColor
                                    ? Tt.effects[i].displayColor
                                    : 0,
                                Tt.effects[i].displaySaturation *
                                    (!0 !== Tt.effects[i].disabled ? 1 : 0.5),
                                Tt.effects[i].displayBrightness,
                                200 *
                                    (1 - Tt.headerH) *
                                    (!0 !== Tt.effects[i].disabled ? 1 : 0.5)
                            ),
                            -1 !== Tt.effectMultiSel.indexOf(i) &&
                                (colorMode(RGB),
                                stroke(255, 175, 0, 255 * (1 - Tt.headerH)),
                                strokeWeight(kt / 4)),
                            rect(
                                (width / 32) *
                                    (Tt.effects[i].time * e) *
                                    (1 / Tt.snap) +
                                    ((width / 32) *
                                        (1 / Tt.snap) *
                                        (Tt.effects[i].moveTime * e)) /
                                        2,
                                (height / 16) * Tt.headerY +
                                    height / 16 -
                                    height / 16 / 2 +
                                    (height / 24) * Tt.effects[i].track,
                                constrain(
                                    (width / 32) *
                                        (1 / Tt.snap) *
                                        (Tt.effects[i].moveTime * e),
                                    width / 64,
                                    9999999999999
                                ),
                                width / 64,
                                (width / 32) *
                                    (1 / Tt.snap) *
                                    (Tt.effects[i].moveTime * e) <
                                    width / 64
                                    ? width
                                    : 0
                            ),
                            textAlign(LEFT, CENTER),
                            colorMode(RGB),
                            fill(
                                !0 !== Tt.effects[i].disabled ? 255 : 200,
                                255 * (1 - Tt.headerH)
                            ),
                            noStroke(),
                            Pt(Tt.effectTypeNames[Tt.effects[i].type], xt));
                    Dt(
                        "" === Tt.effects[i].displayName
                            ? ht
                            : Tt.effects[i].displayName + " (" + ht + ")",
                        (width / 32) *
                            (Tt.effects[i].time * e) *
                            (1 / Tt.snap) +
                            width / 64 / 2,
                        (height / 16) * Tt.headerY +
                            height / 16 -
                            height / 16 / 2 +
                            (height / 24) * Tt.effects[i].track,
                        constrain(
                            (width / 32) *
                                (1 / Tt.snap) *
                                (Tt.effects[i].moveTime * e),
                            width / 16,
                            9999999999999
                        ) -
                            width / 64 / 2,
                        width / 64 / 1.5
                    );
                }
            strokeWeight(floor(width / 48) / 3 / 6), ellipseMode(CENTER);
            for (i = 0; i < Tt.sections.length; i++)
                colorMode(RGB),
                    -1 === Tt.sectionsSelected.indexOf(i)
                        ? stroke(255, 255 * (1 - Tt.headerH))
                        : stroke(255, 175, 0, 255 * (1 - Tt.headerH)),
                    colorMode(HSB),
                    fill(
                        Tt.sections[i].color,
                        Tt.sections[i].saturation,
                        Tt.sections[i].brightness,
                        255 * (1 - Tt.headerH)
                    ),
                    ellipse(
                        (width / 32) *
                            (Tt.sections[i].time * e) *
                            (1 / Tt.snap),
                        (height / 16) * Tt.headerY +
                            height / 16 +
                            floor(width / 48) / 3 +
                            (height / 24) * (1 === Tt.editorMode ? k : 0),
                        floor(width / 48) / 3,
                        floor(width / 48) / 3
                    );
            colorMode(RGB), pop(), noStroke(), colorMode(HSB), rectMode(CENTER);
            var at,
                lt = !1;
            void 0 === at && (at = !1);
            for (i = 0; i < Tt.sections.length; i++) {
                it = Tt.sections[i];
                void 0 === Tt.sectionsHighlight[i] &&
                    (Tt.sectionsHighlight[i] = 0),
                    at !== i &&
                        (Tt.sectionsHighlight[i] += At(
                            0,
                            Tt.sectionsHighlight[i],
                            0.2
                        )),
                    !nt &&
                        Ft(
                            "rcenter",
                            ((width - width / 128) / Tt.timeEnd) * it.time +
                                width / 128 / 2,
                            ((height / 16) * (Tt.headerH + 1)) / 2,
                            width / 128,
                            (height / 16) * (Tt.headerH + 1)
                        ) &&
                        (lt = i),
                    fill(
                        it.color,
                        it.saturation,
                        it.brightness,
                        200 * Tt.headerH
                    ),
                    rect(
                        ((width - width / 128) / Tt.timeEnd) * it.time +
                            width / 128 / 2,
                        ((height / 16) * (Tt.headerH + 1)) / 2,
                        (width / 128 / 4) *
                            (it.visible ? 2 : 1) *
                            (Tt.sectionsHighlight[i] + 1),
                        (height / 16) * (Tt.headerH + 1)
                    );
            }
            !1 !== (at = lt) &&
                (Tt.sectionsHighlight[lt] += At(
                    1,
                    Tt.sectionsHighlight[lt],
                    0.3
                )),
                colorMode(RGB),
                !1 !== lt &&
                    "scroll" === Tt.timelineMode &&
                    (fill(0, 200),
                    rectMode(CENTER),
                    rect(
                        width / 2,
                        (height / 16) * (Tt.headerH + 1) + 1.5 * kt,
                        width / 3 - 2 * kt,
                        height / 32 + kt,
                        kt
                    ),
                    fill(255),
                    textAlign(CENTER, CENTER),
                    Dt(
                        Tt.sections[lt].name,
                        width / 2,
                        (height / 16) * (Tt.headerH + 1) + 1.5 * kt,
                        width / 3 - 3 * kt,
                        height / 32
                    )),
                rectMode(CORNER),
                fill(255, 255 * (0.5 - Tt.headerH)),
                noStroke(),
                rect(
                    width / 2 - width / 512 / 2,
                    0,
                    width / 512,
                    height / 16 + (height / 24) * (1 === Tt.editorMode ? k : 0)
                ),
                rectMode(CENTER),
                fill(255, 200 * Tt.headerH),
                noStroke(),
                rect(
                    ((width - width / 128) / Tt.timeEnd) * Tt.time +
                        width / 128 / 2,
                    ((height / 16) * (Tt.headerH + 1)) / 2,
                    width / 128,
                    (height / 16) * (Tt.headerH + 1)
                ),
                nt &&
                    (push(),
                    rectMode(CORNER),
                    fill(255, 100),
                    rect(0, 0, kt, kt),
                    pop(),
                    ($t = Pt("edit_copyTimestamp", xt))),
                textAlign(LEFT, TOP),
                fill(255, 200),
                Dt(
                    Tt.timelineTickFor(Tt.time) +
                        " (" +
                        Tt.timelineBPM +
                        ") (" +
                        Pt("milliseconds_short", xt, Tt.timelineOffset) +
                        ")\n" +
                        Wo((Tt.time / Tt.bpm) * 60 * 1e3, "min:sec:ms"),
                    kt / 4,
                    kt / 4,
                    width - kt / 2,
                    kt / 2
                );
        }
        if (
            (!0 === Tt.menu
                ? (Tt.menuSize += At(1, Tt.menuSize, 0.2))
                : (Tt.menuSize += At(0, Tt.menuSize, 0.2)),
            0 === Tt.sectionsSelected.length)
        ) {
            if (1 === Tt.editorMode && Tt.showGUI) {
                if (
                    (fill(0, 0, 0, 200),
                    rectMode(CORNER),
                    noStroke(),
                    rect(
                        width - width / 4,
                        (height / 16) * 2,
                        width / 2,
                        (height / 16) * 12,
                        (width < height ? width : height) / 32
                    ),
                    1 === Tt.effectMultiSel.length
                        ? (Tt.effectSel = Tt.effectMultiSel[0])
                        : (Tt.effectSel = !1),
                    Tt.effectMultiSel.length <= 1
                        ? (Tt.effectMultiSelLast = !1)
                        : (Tt.effectSelLast = !1),
                    !1 === Tt.effectSel &&
                        !1 !== Tt.effectSelLast &&
                        0 === Tt.effectMultiSel.length)
                ) {
                    function dt(t) {
                        var i = Tt.timelineTickFor(Tt.time);
                        for (
                            let e = (Tt.effectMultiSel.length = 0);
                            e < Tt.effects.length;
                            e++
                        ) {
                            var o = Tt.effects[e];
                            t(i, Tt.timelineTickFor(o.time)) &&
                                Tt.effectMultiSel.push(e);
                        }
                    }
                    (Tt.effectsNSM.pages = [
                        {
                            title: "edit_effects_automation",
                            items: [
                                {
                                    type: "button",
                                    name: "edit_effects_item_newAutomation",
                                    event: function () {
                                        Tt.effects.push({
                                            type: 0,
                                            time: Tt.time,
                                            bpm: Tt.timelineBPM,
                                            offset: Tt.timelineOffset,
                                            moveTime:
                                                (1 / Tt.timelineBPM) * 120,
                                            easeType: 0,
                                            moveX: 0,
                                            moveY: 0,
                                            track: 0,
                                        }),
                                            Tt.effectMultiSel.push(
                                                Tt.effects.length - 1
                                            );
                                    },
                                    hint: "edit_effects_item_newAutomation_sub",
                                },
                            ],
                        },
                        {
                            title: "edit_select_quickSelect",
                            items: [
                                {
                                    type: "button",
                                    name: "edit_select_item_selectBefore",
                                    hint: "edit_select_item_selectBefore_sub",
                                    event: () => dt((e, t) => t <= e),
                                },
                                {
                                    type: "button",
                                    name: "edit_select_item_selectCurrent",
                                    hint: "edit_select_item_selectCurrent_sub",
                                    event: () => dt((e, t) => t === e),
                                },
                                {
                                    type: "button",
                                    name: "edit_select_item_selectAfter",
                                    hint: "edit_select_item_selectAfter_sub",
                                    event: () => dt((e, t) => e <= t),
                                },
                            ],
                        },
                    ]),
                        (Tt.effectsNSM.data.page = 0),
                        (Tt.effectSelLast = !1);
                } else if (
                    (Tt.effectSelLast !== Tt.effectSel ||
                        (!1 !== Tt.effectSel &&
                            Tt.effectTypeLast !==
                                Tt.effects[Tt.effectSel].type)) &&
                    1 === Tt.effectMultiSel.length
                ) {
                    Tt.effectsNSM.pages = [];
                    for (var gt = [], i = 0; i < Tt.effectTypeNames.length; i++)
                        gt.push(i);
                    for (
                        var N = [
                                {
                                    type: "dropdown",
                                    name: "edit_effects_item_automationType",
                                    hint: "edit_effects_item_automationType_sub",
                                    var: [Tt.effects[Tt.effectSel], "type"],
                                    options: gt,
                                    labels: Tt.effectTypeNames,
                                },
                                {
                                    type: "number",
                                    name: "edit_effects_item_startTime",
                                    hint: "edit_effects_item_startTime_sub",
                                    var: [Tt.effects[Tt.effectSel], "time"],
                                    min: !1,
                                    max: !1,
                                    bigChange: 1,
                                    smallChange: [Tt, "snap"],
                                    display: function () {
                                        return Xt({
                                            recieve: "bpm",
                                            time: Tt.effects[Tt.effectSel].time,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: Tt.effects[Tt.effectSel]
                                                .offset,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                    update: function (e) {
                                        (e.bigChange = Xt({
                                            recieve: "raw",
                                            time: 1,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        })),
                                            (e.smallChange = Xt({
                                                recieve: "raw",
                                                time: Tt.snap,
                                                bpm: Tt.effects[Tt.effectSel]
                                                    .bpm,
                                                offset: 0,
                                                lvlBPM: Tt.bpm,
                                            }));
                                    },
                                    convert: function (e) {
                                        return Xt({
                                            recieve: "raw",
                                            time: e,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: Tt.effects[Tt.effectSel]
                                                .offset,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                },
                                {
                                    type: "number",
                                    name: "edit_select_item_bpm",
                                    hint: "edit_select_item_bpm_sub",
                                    var: [Tt.effects[Tt.effectSel], "bpm"],
                                    min: !1,
                                    max: !1,
                                    bigChange: 10,
                                    smallChange: 1,
                                },
                                {
                                    type: "number",
                                    name: "edit_select_item_offset",
                                    hint: "edit_select_item_offset_sub",
                                    var: [Tt.effects[Tt.effectSel], "offset"],
                                    min: !1,
                                    max: !1,
                                    bigChange: 10,
                                    smallChange: 1,
                                },
                                {
                                    type: "number",
                                    name: "edit_effects_item_duration",
                                    hint: "edit_effects_item_duration_sub",
                                    var: [Tt.effects[Tt.effectSel], "moveTime"],
                                    min: 0,
                                    max: !1,
                                    bigChange: 1,
                                    smallChange: [Tt, "snap"],
                                    display: function () {
                                        return Xt({
                                            recieve: "bpm",
                                            time: Tt.effects[Tt.effectSel]
                                                .moveTime,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                    update: function (e) {
                                        (e.bigChange = Xt({
                                            recieve: "raw",
                                            time: 1,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        })),
                                            (e.smallChange = Xt({
                                                recieve: "raw",
                                                time: Tt.snap,
                                                bpm: Tt.effects[Tt.effectSel]
                                                    .bpm,
                                                offset: 0,
                                                lvlBPM: Tt.bpm,
                                            }));
                                    },
                                    convert: function (e) {
                                        return Xt({
                                            recieve: "raw",
                                            time: e,
                                            bpm: Tt.effects[Tt.effectSel].bpm,
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                },
                            ],
                            ct =
                                (9 === Tt.effects[Tt.effectSel].type
                                    ? ((Tt.effectsNSM.pages[0] = {
                                          title: "edit_effects_formatting",
                                          items: [],
                                      }),
                                      (Tt.effectsNSM.pages[0].items =
                                          Tt.effectsNSM.pages[0].items.concat(
                                              N.splice(0, 1)
                                          )),
                                      (Tt.effectsNSM.pages[1] = {
                                          title: "edit_effects_automation",
                                          items: [],
                                      }),
                                      (Tt.effectsNSM.pages[1].items =
                                          Tt.effectsNSM.pages[1].items.concat(
                                              N
                                          )),
                                      (Tt.effectsNSM.pages[2] = {
                                          title: "edit_effects_customize",
                                          items: [],
                                      }))
                                    : ((Tt.effectsNSM.pages[0] = {
                                          title: "edit_effects_automation",
                                          items: [],
                                      }),
                                      (Tt.effectsNSM.pages[0].items =
                                          Tt.effectsNSM.pages[0].items.concat(
                                              N
                                          )),
                                      (Tt.effectsNSM.pages[1] = {
                                          title: "edit_effects_customize",
                                          items: [],
                                      })),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].displayColor &&
                                    (Tt.effects[Tt.effectSel].displayColor = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .displaySaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].displaySaturation = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .displayBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].displayBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].displayName &&
                                    (Tt.effects[Tt.effectSel].displayName = ""),
                                void 0 === Tt.effects[Tt.effectSel].disabled &&
                                    (Tt.effects[Tt.effectSel].disabled = !1),
                                (Tt.effectsNSM.pages[
                                    Tt.effectsNSM.pages.length - 1
                                ].items = [
                                    {
                                        type: "string",
                                        name: "edit_effects_item_displayName",
                                        hint: "edit_effects_item_displayName_sub",
                                        var: [
                                            Tt.effects[Tt.effectSel],
                                            "displayName",
                                        ],
                                    },
                                    {
                                        type: "color",
                                        name: "edit_effects_item_displayColor",
                                        hint: "edit_effects_item_displayColor_sub",
                                        mode: HSB,
                                        hue: [
                                            Tt.effects[Tt.effectSel],
                                            "displayColor",
                                        ],
                                        saturation: [
                                            Tt.effects[Tt.effectSel],
                                            "displaySaturation",
                                        ],
                                        brightness: [
                                            Tt.effects[Tt.effectSel],
                                            "displayBrightness",
                                        ],
                                    },
                                    {
                                        type: "number",
                                        name: "edit_effects_item_track",
                                        hint: "edit_effects_item_track_sub",
                                        var: [
                                            Tt.effects[Tt.effectSel],
                                            "track",
                                        ],
                                        min: 0,
                                        max: 21,
                                        bigChange: 3,
                                        smallChange: 1,
                                    },
                                    {
                                        type: "boolean",
                                        name: "edit_effects_item_disable",
                                        var: [
                                            Tt.effects[Tt.effectSel],
                                            "disabled",
                                        ],
                                        hint: "edit_effects_item_disable_sub",
                                    },
                                    {
                                        type: "button",
                                        name: "edit_select_item_copy",
                                        event: On,
                                        hint: "edit_select_item_copy_sub",
                                    },
                                    {
                                        type: "button",
                                        name: "edit_effects_item_deleteAutomation",
                                        event: function () {
                                            Tt.effects.splice(Tt.effectSel, 1),
                                                Tt.effectMultiSel.splice(
                                                    Tt.effectMultiSel.indexOf(
                                                        i
                                                    ),
                                                    1
                                                ),
                                                (Tt.effectsTabSel = 0);
                                        },
                                        hint: "edit_effects_item_deleteAutomation_sub",
                                    },
                                ]),
                                []),
                            i = 0;
                        i < Tt.textAlignNames.length;
                        i++
                    )
                        ct.push(i);
                    for (
                        var ft = [], i = 0;
                        i < Tt.textDirectionNames.length;
                        i++
                    )
                        ft.push(i);
                    var Q = {
                        moveX: {
                            type: "number",
                            name: "edit_effects_item_moveX",
                            hint: "edit_effects_item_moveX_sub",
                            var: [Tt.effects[Tt.effectSel], "moveX"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        moveY: {
                            type: "number",
                            name: "edit_effects_item_moveY",
                            hint: "edit_effects_item_moveY_sub",
                            var: [Tt.effects[Tt.effectSel], "moveY"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        scaleX: {
                            type: "number",
                            name: "edit_effects_item_scaleX",
                            hint: "edit_effects_item_scaleX_sub",
                            var: [Tt.effects[Tt.effectSel], "scaleX"],
                            min: !1,
                            max: !1,
                            bigChange: 1,
                            smallChange: 0.1,
                        },
                        scaleY: {
                            type: "number",
                            name: "edit_effects_item_scaleY",
                            hint: "edit_effects_item_scaleY_sub",
                            var: [Tt.effects[Tt.effectSel], "scaleY"],
                            min: !1,
                            max: !1,
                            bigChange: 1,
                            smallChange: 0.1,
                        },
                        moveD: {
                            type: "number",
                            name: "edit_effects_item_moveD",
                            hint: "edit_effects_item_moveD_sub",
                            var: [Tt.effects[Tt.effectSel], "moveD"],
                            min: !1,
                            max: !1,
                            bigChange: 9,
                            smallChange: 1,
                        },
                        tileID: {
                            type: "tiles",
                            name: "edit_effects_item_tileID",
                            hint: "edit_effects_item_tileID_sub",
                            var: [Tt.effects[Tt.effectSel], "tileID"],
                        },
                        foresight: {
                            type: "number",
                            name: "edit_effects_item_targetValue",
                            hint: "edit_effects_item_targetValue_sub",
                            var: [Tt.effects[Tt.effectSel], "targetValue"],
                            min: !1,
                            max: !1,
                            bigChange: 0.3,
                            smallChange: 0.1,
                        },
                        targetValue: {
                            type: "number",
                            name: "edit_effects_item_targetValue",
                            hint: "edit_effects_item_targetValue_sub",
                            var: [Tt.effects[Tt.effectSel], "targetValue"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        vignette: {
                            type: "number",
                            name: "edit_effects_item_targetValue",
                            hint: "edit_effects_item_targetValue_sub",
                            var: [Tt.effects[Tt.effectSel], "vignette"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        text: {
                            type: "string",
                            name: "edit_effects_item_text",
                            hint: "edit_effects_item_text_sub",
                            var: [Tt.effects[Tt.effectSel], "text"],
                        },
                        posX: {
                            type: "number",
                            name: "edit_effects_item_posX",
                            hint: "edit_effects_item_posX_sub",
                            var: [Tt.effects[Tt.effectSel], "posX"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        posY: {
                            type: "number",
                            name: "edit_effects_item_posY",
                            hint: "edit_effects_item_posY_sub",
                            var: [Tt.effects[Tt.effectSel], "posY"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        posD: {
                            type: "number",
                            name: "edit_effects_item_moveD",
                            hint: "edit_effects_item_moveD_sub",
                            var: [Tt.effects[Tt.effectSel], "posD"],
                            min: !1,
                            max: !1,
                            bigChange: 9,
                            smallChange: 1,
                        },
                        size: {
                            type: "number",
                            name: "edit_effects_item_size",
                            hint: "edit_effects_item_size_sub",
                            var: [Tt.effects[Tt.effectSel], "size"],
                            min: 0,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        textAl: {
                            type: "dropdown",
                            name: "edit_effects_item_textAlign",
                            hint: "edit_effects_item_textAlign_sub",
                            var: [Tt.effects[Tt.effectSel], "textAl"],
                            options: ct,
                            labels: Tt.textAlignNames,
                        },
                        textDi: {
                            type: "dropdown",
                            name: "edit_effects_item_textDirection",
                            hint: "edit_effects_item_textDirection_sub",
                            var: [Tt.effects[Tt.effectSel], "textDi"],
                            options: ft,
                            labels: Tt.textDirectionNames,
                        },
                        highlight: {
                            type: "number",
                            name: "edit_effects_item_highlight",
                            hint: "edit_effects_item_highlight_sub",
                            var: [Tt.effects[Tt.effectSel], "highlight"],
                            min: 0,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        highlightColor: {
                            type: "color",
                            name: "edit_effects_item_highlightColor",
                            hint: "edit_effects_item_highlightColor_sub",
                            mode: HSB,
                            hue: [Tt.effects[Tt.effectSel], "highlightColor"],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "highlightSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "highlightBrightness",
                            ],
                            alpha: [Tt.effects[Tt.effectSel], "highlightAlpha"],
                        },
                        backgroundColor: {
                            type: "color",
                            name: "edit_effects_item_backgroundColor",
                            hint: "edit_effects_item_backgroundColor_sub",
                            mode: HSB,
                            hue: [Tt.effects[Tt.effectSel], "backgroundColor"],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "backgroundSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "backgroundBrightness",
                            ],
                            alpha: [
                                Tt.effects[Tt.effectSel],
                                "backgroundAlpha",
                            ],
                        },
                        transparency: {
                            type: "number",
                            name: "edit_effects_item_transparency",
                            hint: "edit_effects_item_transparency_sub",
                            var: [Tt.effects[Tt.effectSel], "transparency"],
                            min: 0,
                            max: 255,
                            bigChange: 16,
                            smallChange: 1,
                        },
                        movePosX: {
                            type: "number",
                            name: "edit_effects_item_posX",
                            hint: "edit_effects_item_posX_sub",
                            var: [Tt.effects[Tt.effectSel], "moveX"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        movePosY: {
                            type: "number",
                            name: "edit_effects_item_posY",
                            hint: "edit_effects_item_posY_sub",
                            var: [Tt.effects[Tt.effectSel], "moveY"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        moveSize: {
                            type: "number",
                            name: "edit_effects_item_size",
                            hint: "edit_effects_item_size_sub",
                            var: [Tt.effects[Tt.effectSel], "moveSize"],
                            min: !1,
                            max: !1,
                            bigChange: 8,
                            smallChange: 1,
                        },
                        targetHighlightColor: {
                            type: "color",
                            name: "edit_effects_item_highlightColor",
                            hint: "edit_effects_item_highlightColor_sub",
                            mode: HSB,
                            hue: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightColor",
                            ],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightBrightness",
                            ],
                            alpha: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightAlpha",
                            ],
                            loops: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightLoops",
                            ],
                            smooth: [
                                Tt.effects[Tt.effectSel],
                                "targetHighlightSmooth",
                            ],
                        },
                        targetBackgroundColor: {
                            type: "color",
                            name: "edit_effects_item_backgroundColor",
                            hint: "edit_effects_item_backgroundColor_sub",
                            mode: HSB,
                            hue: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundColor",
                            ],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundBrightness",
                            ],
                            alpha: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundAlpha",
                            ],
                            loops: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundLoops",
                            ],
                            smooth: [
                                Tt.effects[Tt.effectSel],
                                "targetBackgroundSmooth",
                            ],
                        },
                        startColor: {
                            type: "color",
                            name: "edit_effects_item_startColor",
                            hint: "edit_effects_item_startColor_sub",
                            mode: HSB,
                            hue: [Tt.effects[Tt.effectSel], "startColor"],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "startSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "startBrightness",
                            ],
                            alpha: [Tt.effects[Tt.effectSel], "startAlpha"],
                        },
                        endColor: {
                            type: "color",
                            name: "edit_effects_item_endColor",
                            hint: "edit_effects_item_endColor_sub",
                            mode: HSB,
                            hue: [Tt.effects[Tt.effectSel], "endColor"],
                            saturation: [
                                Tt.effects[Tt.effectSel],
                                "endSaturation",
                            ],
                            brightness: [
                                Tt.effects[Tt.effectSel],
                                "endBrightness",
                            ],
                            alpha: [Tt.effects[Tt.effectSel], "endAlpha"],
                            loops: [Tt.effects[Tt.effectSel], "endLoops"],
                            smooth: [Tt.effects[Tt.effectSel], "endSmooth"],
                        },
                        setColorForTile: {
                            type: "dropdown",
                            name: "edit_effects_item_setColorFor",
                            hint: "edit_effects_item_setColorFor_sub",
                            var: [Tt.effects[Tt.effectSel], "setColorFor"],
                            options: [0, 1, 2],
                            labels: [
                                "edit_effects_tileBorder",
                                "edit_effects_tileOverlay",
                                "edit_effects_tileBoth",
                            ],
                        },
                        setColorForOverlay: {
                            type: "dropdown",
                            name: "edit_effects_item_setColorFor",
                            hint: "edit_effects_item_setColorFor_sub",
                            var: [Tt.effects[Tt.effectSel], "setColorFor"],
                            options: [0, 1],
                            labels: [
                                "edit_effects_overlayBackground",
                                "edit_effects_overlayForeground",
                            ],
                        },
                        trailLength: {
                            type: "number",
                            name: "edit_effects_item_trailLength",
                            hint: "edit_effects_item_trailLength_sub",
                            var: [Tt.effects[Tt.effectSel], "trailLength"],
                            min: !1,
                            max: !1,
                            bigChange: 2,
                            smallChange: 1,
                        },
                        trailSpacing: {
                            type: "number",
                            name: "edit_effects_item_trailSpacing",
                            hint: "edit_effects_item_trailSpacing_sub",
                            var: [Tt.effects[Tt.effectSel], "trailSpacing"],
                            min: !1,
                            max: !1,
                            bigChange: 10,
                            smallChange: 1,
                        },
                        trailAlpha: {
                            type: "number",
                            name: "edit_effects_item_trailAlpha",
                            hint: "edit_effects_item_trailAlpha_sub",
                            var: [Tt.effects[Tt.effectSel], "trailAlpha"],
                            min: !1,
                            max: !1,
                            bigChange: 16,
                            smallChange: 1,
                        },
                        trailColor: {
                            type: "boolean",
                            name: "edit_effects_item_trailColor",
                            hint: "edit_effects_item_trailColor_sub",
                            var: [Tt.effects[Tt.effectSel], "trailColor"],
                        },
                        trailDelete: {
                            type: "boolean",
                            name: "edit_effects_item_trailDelete",
                            hint: "edit_effects_item_trailDelete_sub",
                            var: [Tt.effects[Tt.effectSel], "trailDelete"],
                        },
                    };
                    switch (Tt.effects[Tt.effectSel].type) {
                        default:
                            Tt.effectsNSM.pages[0].items.push(Q.moveX, Q.moveY);
                            break;
                        case 1:
                            void 0 === Tt.effects[Tt.effectSel].scaleX &&
                                (Tt.effects[Tt.effectSel].scaleX = 1),
                                void 0 === Tt.effects[Tt.effectSel].scaleY &&
                                    (Tt.effects[Tt.effectSel].scaleY = 1),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.scaleX,
                                    Q.scaleY
                                );
                            break;
                        case 2:
                            void 0 === Tt.effects[Tt.effectSel].moveD &&
                                (Tt.effects[Tt.effectSel].moveD = 0),
                                Tt.effectsNSM.pages[0].items.push(Q.moveD);
                            break;
                        case 3:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.moveX,
                                    Q.moveY
                                );
                            break;
                        case 4:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                void 0 === Tt.effects[Tt.effectSel].scaleX &&
                                    (Tt.effects[Tt.effectSel].scaleX = 1),
                                void 0 === Tt.effects[Tt.effectSel].scaleY &&
                                    (Tt.effects[Tt.effectSel].scaleY = 1),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.scaleX,
                                    Q.scaleY
                                );
                            break;
                        case 5:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                void 0 === Tt.effects[Tt.effectSel].moveD &&
                                    (Tt.effects[Tt.effectSel].moveD = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.moveD
                                );
                            break;
                        case 6:
                            void 0 === Tt.effects[Tt.effectSel].targetValue &&
                                (Tt.effects[Tt.effectSel].targetValue = 0),
                                Tt.effectsNSM.pages[0].items.push(Q.foresight);
                            break;
                        case 7:
                            void 0 === Tt.effects[Tt.effectSel].targetValue &&
                                (Tt.effects[Tt.effectSel].targetValue = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.targetValue
                                );
                            break;
                        case 8:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].targetValue &&
                                    (Tt.effects[Tt.effectSel].targetValue = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.targetValue
                                );
                            break;
                        case 9:
                            void 0 === Tt.effects[Tt.effectSel].posX &&
                                (Tt.effects[Tt.effectSel].posX = 50),
                                void 0 === Tt.effects[Tt.effectSel].posY &&
                                    (Tt.effects[Tt.effectSel].posY = 50),
                                void 0 === Tt.effects[Tt.effectSel].posD &&
                                    (Tt.effects[Tt.effectSel].posD = 0),
                                void 0 === Tt.effects[Tt.effectSel].size &&
                                    (Tt.effects[Tt.effectSel].size = 10),
                                void 0 === Tt.effects[Tt.effectSel].text &&
                                    (Tt.effects[Tt.effectSel].text = "Text"),
                                void 0 === Tt.effects[Tt.effectSel].textAl &&
                                    (Tt.effects[Tt.effectSel].textAl = 4),
                                void 0 === Tt.effects[Tt.effectSel].textDi &&
                                    (Tt.effects[Tt.effectSel].textDi = 0),
                                void 0 === Tt.effects[Tt.effectSel].highlight &&
                                    (Tt.effects[Tt.effectSel].highlight = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].highlightColor &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].highlightColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .highlightSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].highlightSaturation = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .highlightBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].highlightBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].highlightAlpha &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].highlightAlpha = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].backgroundColor &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].backgroundColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .backgroundSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].backgroundSaturation = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .backgroundBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].backgroundBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].backgroundAlpha &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].backgroundAlpha = 255),
                                void 0 === Tt.effects[Tt.effectSel].moveX &&
                                    (Tt.effects[Tt.effectSel].moveX = 0),
                                void 0 === Tt.effects[Tt.effectSel].moveY &&
                                    (Tt.effects[Tt.effectSel].moveY = 0),
                                void 0 === Tt.effects[Tt.effectSel].moveD &&
                                    (Tt.effects[Tt.effectSel].moveD = 0),
                                void 0 === Tt.effects[Tt.effectSel].moveSize &&
                                    (Tt.effects[Tt.effectSel].moveSize = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightColor &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightSaturation = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightAlpha &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightAlpha = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightLoops &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightLoops = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetHighlightSmooth &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetHighlightSmooth = !0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundColor &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundSaturation = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundAlpha &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundAlpha = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundLoops &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundLoops = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel]
                                        .targetBackgroundSmooth &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].targetBackgroundSmooth = !0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.text,
                                    Q.posX,
                                    Q.posY,
                                    Q.posD,
                                    Q.size,
                                    Q.textAl,
                                    Q.textDi,
                                    Q.highlight,
                                    Q.highlightColor,
                                    Q.backgroundColor
                                ),
                                Tt.effectsNSM.pages[1].items.push(
                                    Q.movePosX,
                                    Q.movePosY,
                                    Q.moveD,
                                    Q.moveSize,
                                    Q.targetHighlightColor,
                                    Q.targetBackgroundColor
                                );
                            break;
                        case 10:
                            void 0 === Tt.effects[Tt.effectSel].vignette &&
                                (Tt.effects[Tt.effectSel].vignette = 1),
                                Tt.effectsNSM.pages[0].items.push(Q.vignette);
                            break;
                        case 11:
                            void 0 === Tt.effects[Tt.effectSel].moveX &&
                                (Tt.effects[Tt.effectSel].moveX = 0),
                                void 0 === Tt.effects[Tt.effectSel].moveY &&
                                    (Tt.effects[Tt.effectSel].moveY = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.moveX,
                                    Q.moveY
                                );
                            break;
                        case 12:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startColor &&
                                    (Tt.effects[Tt.effectSel].startColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].startSaturation = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].startBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startAlpha &&
                                    (Tt.effects[Tt.effectSel].startAlpha = 255),
                                void 0 === Tt.effects[Tt.effectSel].endColor &&
                                    (Tt.effects[Tt.effectSel].endColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].endSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].endSaturation = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].endBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].endBrightness = 255),
                                void 0 === Tt.effects[Tt.effectSel].endAlpha &&
                                    (Tt.effects[Tt.effectSel].endAlpha = 255),
                                void 0 === Tt.effects[Tt.effectSel].endLoops &&
                                    (Tt.effects[Tt.effectSel].endLoops = 0),
                                void 0 === Tt.effects[Tt.effectSel].endSmooth &&
                                    (Tt.effects[Tt.effectSel].endSmooth = !0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].setColorFor &&
                                    (Tt.effects[Tt.effectSel].setColorFor = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.startColor,
                                    Q.endColor,
                                    Q.setColorForTile
                                );
                            break;
                        case 13:
                            void 0 === Tt.effects[Tt.effectSel].startColor &&
                                (Tt.effects[Tt.effectSel].startColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].startSaturation = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].startBrightness = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].startAlpha &&
                                    (Tt.effects[Tt.effectSel].startAlpha = 0),
                                void 0 === Tt.effects[Tt.effectSel].endColor &&
                                    (Tt.effects[Tt.effectSel].endColor = 141),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].endSaturation &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].endSaturation = 255),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].endBrightness &&
                                    (Tt.effects[
                                        Tt.effectSel
                                    ].endBrightness = 255),
                                void 0 === Tt.effects[Tt.effectSel].endAlpha &&
                                    (Tt.effects[Tt.effectSel].endAlpha = 100),
                                void 0 === Tt.effects[Tt.effectSel].endLoops &&
                                    (Tt.effects[Tt.effectSel].endLoops = 0),
                                void 0 === Tt.effects[Tt.effectSel].endSmooth &&
                                    (Tt.effects[Tt.effectSel].endSmooth = !0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].setColorFor &&
                                    (Tt.effects[Tt.effectSel].setColorFor = 0),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.startColor,
                                    Q.endColor,
                                    Q.setColorForOverlay
                                );
                            break;
                        case 14:
                            void 0 === Tt.effects[Tt.effectSel].tileID &&
                                (Tt.effects[Tt.effectSel].tileID = [0]),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].trailLength &&
                                    (Tt.effects[Tt.effectSel].trailLength = 5),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].trailSpacing &&
                                    (Tt.effects[Tt.effectSel].trailSpacing = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].trailAlpha &&
                                    (Tt.effects[Tt.effectSel].trailAlpha = 0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].trailColor &&
                                    (Tt.effects[Tt.effectSel].trailColor = !0),
                                void 0 ===
                                    Tt.effects[Tt.effectSel].trailDelete &&
                                    (Tt.effects[Tt.effectSel].trailDelete = !1),
                                Tt.effectsNSM.pages[0].items.push(
                                    Q.tileID,
                                    Q.trailLength,
                                    Q.trailSpacing,
                                    Q.trailAlpha,
                                    Q.trailColor,
                                    Q.trailDelete
                                );
                    }
                    for (var ut = [], i = 0; i < Hi.length; i++) ut.push(i);
                    T = 0;
                    9 === Tt.effects[Tt.effectSel].type && (T = 1),
                        Tt.effectsNSM.pages[T].items.push({
                            type: "dropdown",
                            name: "edit_effects_item_easeType",
                            hint: "edit_effects_item_easeType_sub",
                            var: [Tt.effects[Tt.effectSel], "easeType"],
                            options: ut,
                            labels: Hi,
                        }),
                        Tt.effectsNSM.pages[0].items.push({
                            type: "button",
                            name: "edit_effects_item_deselectAutomation",
                            event: function () {
                                (Tt.effectMultiSel = []),
                                    (Tt.effectMultiSelLast = !1),
                                    (Tt.effectSelLast = !0);
                            },
                            hint: "edit_effects_item_deselectAutomation_sub",
                        }),
                        (Tt.effectSelLast = Tt.effectSel),
                        (Tt.effectTypeLast = Tt.effects[Tt.effectSel].type);
                } else if (
                    1 < Tt.effectMultiSel.length &&
                    Tt.effectMultiSelLast !== Tt.effectMultiSel
                ) {
                    (Tt.effectMultiSelLast = Tt.effectMultiSel),
                        (Tt.effectsNSM.pages = [
                            {
                                title: "edit_effects_automation",
                                items: [],
                            },
                            {
                                title: "edit_effects_customize",
                                items: [],
                            },
                        ]);
                    for (
                        var I = {
                                time: [],
                                moveTime: [],
                                track: [],
                                disabled: [],
                            },
                            i = 0;
                        i < Tt.effectMultiSel.length;
                        i++
                    ) {
                        Oe = Tt.effectMultiSel[i];
                        I.time.push([Tt.effects[Oe], "time"]),
                            I.moveTime.push([Tt.effects[Oe], "moveTime"]),
                            I.track.push([Tt.effects[Oe], "track"]),
                            I.disabled.push([Tt.effects[Oe], "disabled"]);
                    }
                    Tt.effectsNSM.pages[0].items.push(
                        {
                            type: "number",
                            name: "edit_effects_item_startTime",
                            hint: "edit_effects_item_startTime_sub",
                            min: !1,
                            max: !1,
                            bigChange: 1,
                            smallChange: [Tt, "snap"],
                            multiple: !0,
                            vars: I.time,
                            update: function (e) {
                                (e.bigChange = Xt({
                                    recieve: "raw",
                                    time: 1,
                                    bpm: Tt.timelineBPM,
                                    offset: 0,
                                    lvlBPM: Tt.bpm,
                                })),
                                    (e.smallChange = Xt({
                                        recieve: "raw",
                                        time: Tt.snap,
                                        bpm: Tt.timelineBPM,
                                        offset: 0,
                                        lvlBPM: Tt.bpm,
                                    }));
                            },
                        },
                        {
                            type: "number",
                            name: "edit_effects_item_duration",
                            hint: "edit_effects_item_duration_sub",
                            min: 0,
                            max: !1,
                            bigChange: 1,
                            smallChange: [Tt, "snap"],
                            multiple: !0,
                            vars: I.moveTime,
                            update: function (e) {
                                (e.bigChange = Xt({
                                    recieve: "raw",
                                    time: 1,
                                    bpm: Tt.timelineBPM,
                                    offset: 0,
                                    lvlBPM: Tt.bpm,
                                })),
                                    (e.smallChange = Xt({
                                        recieve: "raw",
                                        time: Tt.snap,
                                        bpm: Tt.timelineBPM,
                                        offset: 0,
                                        lvlBPM: Tt.bpm,
                                    }));
                            },
                        },
                        {
                            type: "button",
                            name: "edit_effects_item_deselectAutomation",
                            event: function () {
                                (Tt.effectMultiSel = []),
                                    (Tt.effectMultiSelLast = !1),
                                    (Tt.effectSelLast = !0);
                            },
                            hint: "edit_effects_item_deselectAutomation_sub",
                        },
                        {
                            type: "button",
                            name: "edit_delete_multiple",
                            keys: [String(Tt.effectMultiSel.length)],
                            hint: "edit_effects_item_deleteAutomation_sub",
                            event: () => {
                                _o.activate(
                                    "edit_delete_confirmEffects",
                                    [String(Tt.effectMultiSel.length)],
                                    () => {
                                        const t = Symbol();
                                        for (const e of Tt.effectMultiSel)
                                            Tt.effects[e] = t;
                                        (Tt.effects = Tt.effects.filter(
                                            (e) => e !== t
                                        )),
                                            (Tt.effectMultiSel = []),
                                            (Tt.effectMultiSelLast = !1),
                                            (Tt.effectSelLast = !0),
                                            (Tt.effectsTabSel = 0);
                                    }
                                );
                            },
                        }
                    ),
                        Tt.effectsNSM.pages[1].items.push(
                            {
                                type: "number",
                                name: "edit_effects_item_track",
                                hint: "edit_effects_item_track_sub",
                                min: 0,
                                max: 21,
                                bigChange: 3,
                                smallChange: 1,
                                multiple: !0,
                                vars: I.track,
                            },
                            {
                                type: "boolean",
                                name: "edit_effects_item_disable",
                                vars: I.disabled,
                                hint: "edit_effects_item_disable_sub",
                                multiple: !0,
                            },
                            {
                                type: "button",
                                name: "edit_select_item_copy",
                                event: On,
                                hint: "edit_select_item_copy_sub",
                            }
                        );
                }
                Tt.effectsNSM.draw({
                    x: width - width / 4,
                    y: (height / 16) * 2,
                    width: width / 4,
                    height: (height / 16) * 12,
                    stacked: !0,
                    maxBarHeight: height / 16 / 1.25,
                    buffer: ((height / 16) * 12) / 128,
                }),
                    fill(255, 200),
                    textAlign(LEFT, TOP),
                    textSize(kt / 2.5),
                    text(Zn(), kt, height / 16 + kt);
            } else if (0 === Tt.editorMode && 0 < Tt.selectedBeats.length) {
                if (
                    (fill(0, 0, 0, 200),
                    rectMode(CORNER),
                    noStroke(),
                    rect(
                        width - width / 4,
                        (height / 16) * 3,
                        width / 2,
                        (height / 16) * 10,
                        (width < height ? width : height) / 32
                    ),
                    !Xi(Tt.sbeatsLast, Tt.selectedBeats))
                ) {
                    for (var vt = [], i = 0; i < Tt.transitionNames.length; i++)
                        vt.push(i);
                    for (
                        I = {
                            time: [],
                            holdLength: [],
                            beatColor: [],
                            beatSaturation: [],
                            beatBrightness: [],
                        },
                            i = 0;
                        i < Tt.selectedBeats.length;
                        i++
                    )
                        I.time.push([Tt.beat[Tt.selectedBeats[i]], "1"]),
                            I.holdLength.push([
                                Tt.beat[Tt.selectedBeats[i]],
                                "6",
                            ]),
                            I.beatColor.push([
                                Tt.beat[Tt.selectedBeats[i]],
                                "11",
                            ]),
                            I.beatSaturation.push([
                                Tt.beat[Tt.selectedBeats[i]],
                                "16",
                            ]),
                            I.beatBrightness.push([
                                Tt.beat[Tt.selectedBeats[i]],
                                "17",
                            ]);
                    if (
                        ((Tt.beatNSM.pages = [
                            {
                                title: "edit_select_metadata",
                                items: [],
                            },
                            {
                                title: "edit_select_transformations",
                                items: [],
                            },
                        ]),
                        1 === Tt.selectedBeats.length)
                    ) {
                        function mt(t) {
                            var e = Tt.selectedBeats[0];
                            if (void 0 !== e) {
                                const o = Tt.beat[e];
                                if (o) {
                                    var i = Tt.timelineTickFor(o[1]);
                                    for (
                                        let e = (Tt.selectedBeats.length = 0);
                                        e < Tt.beat.length;
                                        e++
                                    ) {
                                        const o = Tt.beat[e];
                                        t(i, Tt.timelineTickFor(o[1])) &&
                                            Tt.selectedBeats.push(e);
                                    }
                                }
                            }
                        }
                        Tt.beatNSM.pages[0].items.push(
                            {
                                type: "number",
                                name: "edit_select_item_time",
                                hint: "edit_select_item_time_sub",
                                var: [Tt.beat[Tt.selectedBeats[0]], "1"],
                                min: !1,
                                max: !1,
                                bigChange: 1,
                                smallChange: [Tt, "snap"],
                                display: function () {
                                    return Xt({
                                        recieve: "bpm",
                                        time: Tt.beat[Tt.selectedBeats[0]][1],
                                        bpm: Tt.beat[Tt.selectedBeats[0]][9],
                                        offset: Tt.beat[
                                            Tt.selectedBeats[0]
                                        ][10],
                                        lvlBPM: Tt.bpm,
                                    });
                                },
                                update: function (e) {
                                    (e.bigChange = Xt({
                                        recieve: "raw",
                                        time: 1,
                                        bpm: Tt.beat[Tt.selectedBeats[0]][9],
                                        offset: 0,
                                        lvlBPM: Tt.bpm,
                                    })),
                                        (e.smallChange = Xt({
                                            recieve: "raw",
                                            time: Tt.snap,
                                            bpm: Tt.beat[
                                                Tt.selectedBeats[0]
                                            ][9],
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        }));
                                },
                                convert: function (e) {
                                    return Xt({
                                        recieve: "raw",
                                        time: e,
                                        bpm: Tt.beat[Tt.selectedBeats[0]][9],
                                        offset: Tt.beat[
                                            Tt.selectedBeats[0]
                                        ][10],
                                        lvlBPM: Tt.bpm,
                                    });
                                },
                            },
                            {
                                type: "number",
                                name: "edit_select_item_bpm",
                                hint: "edit_select_item_bpm_sub",
                                var: [Tt.beat[Tt.selectedBeats[0]], "9"],
                                min: 0,
                                max: !1,
                                bigChange: 10,
                                smallChange: 1,
                            },
                            {
                                type: "number",
                                name: "edit_select_item_offset",
                                hint: "edit_select_item_offset_sub",
                                var: [Tt.beat[Tt.selectedBeats[0]], "10"],
                                min: !1,
                                max: !1,
                                bigChange: 10,
                                smallChange: 1,
                            }
                        ),
                            1 === Tt.beat[Tt.selectedBeats[0]][5] &&
                                Tt.beatNSM.pages[0].items.push({
                                    type: "number",
                                    name: "edit_tool_object_holdLength",
                                    hint: "edit_tool_object_holdLength_sub",
                                    var: [Tt.beat[Tt.selectedBeats[0]], "6"],
                                    min: 0,
                                    max: !1,
                                    bigChange: 1,
                                    smallChange: [Tt, "snap"],
                                    display: function () {
                                        return Xt({
                                            recieve: "bpm",
                                            time: Tt.beat[
                                                Tt.selectedBeats[0]
                                            ][6],
                                            bpm: Tt.beat[
                                                Tt.selectedBeats[0]
                                            ][9],
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                    update: function (e) {
                                        (e.bigChange = Xt({
                                            recieve: "raw",
                                            time: 1,
                                            bpm: Tt.beat[
                                                Tt.selectedBeats[0]
                                            ][9],
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        })),
                                            (e.smallChange = Xt({
                                                recieve: "raw",
                                                time: Tt.snap,
                                                bpm: Tt.beat[
                                                    Tt.selectedBeats[0]
                                                ][9],
                                                offset: 0,
                                                lvlBPM: Tt.bpm,
                                            }));
                                    },
                                    convert: function (e) {
                                        return Xt({
                                            recieve: "raw",
                                            time: e,
                                            bpm: Tt.beat[
                                                Tt.selectedBeats[0]
                                            ][9],
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        });
                                    },
                                }),
                            Tt.beatNSM.pages[0].items.push(
                                {
                                    type: "color",
                                    name: "edit_select_item_beatColor",
                                    hint: "edit_select_item_beatColor_sub",
                                    mode: HSB,
                                    hue: [Tt.beat[Tt.selectedBeats[0]], "11"],
                                    saturation: [
                                        Tt.beat[Tt.selectedBeats[0]],
                                        "16",
                                    ],
                                    brightness: [
                                        Tt.beat[Tt.selectedBeats[0]],
                                        "17",
                                    ],
                                },
                                {
                                    name: "edit_select_item_transitionIn",
                                    type: "dropdown",
                                    hint: "edit_select_item_transitionIn_sub",
                                    var: [Tt.beat[Tt.selectedBeats[0]], "13"],
                                    options: vt,
                                    labels: Tt.transitionNames,
                                },
                                {
                                    name: "edit_select_item_transitionOut",
                                    type: "dropdown",
                                    hint: "edit_select_item_transitionOut_sub",
                                    var: [Tt.beat[Tt.selectedBeats[0]], "14"],
                                    options: vt,
                                    labels: Tt.transitionNames,
                                }
                            ),
                            Tt.beatNSM.pages.push({
                                title: "edit_select_quickSelect",
                                items: [],
                            }),
                            Tt.beatNSM.pages[
                                Tt.beatNSM.pages.length - 1
                            ].items.push(
                                {
                                    type: "button",
                                    name: "edit_select_item_selectBefore",
                                    hint: "edit_select_item_selectBefore_sub",
                                    event: () => mt((e, t) => t <= e),
                                },
                                {
                                    type: "button",
                                    name: "edit_select_item_selectCurrent",
                                    hint: "edit_select_item_selectCurrent_sub",
                                    event: () => mt((e, t) => t === e),
                                },
                                {
                                    type: "button",
                                    name: "edit_select_item_selectAfter",
                                    hint: "edit_select_item_selectAfter_sub",
                                    event: () => mt((e, t) => e <= t),
                                }
                            );
                    } else {
                        for (
                            var pt = !1, i = 0;
                            i < Tt.selectedBeats.length;
                            i++
                        )
                            if (0 === Tt.beat[Tt.selectedBeats[i]][5]) {
                                pt = !0;
                                break;
                            }
                        Tt.beatNSM.pages[0].items.push({
                            type: "number",
                            name: "edit_select_item_time",
                            hint: "edit_select_item_time_sub",
                            min: !1,
                            max: !1,
                            bigChange: 1,
                            smallChange: [Tt, "snap"],
                            multiple: !0,
                            vars: I.time,
                            update: function (e) {
                                (e.bigChange = Xt({
                                    recieve: "raw",
                                    time: 1,
                                    bpm: Tt.timelineBPM,
                                    offset: 0,
                                    lvlBPM: Tt.bpm,
                                })),
                                    (e.smallChange = Xt({
                                        recieve: "raw",
                                        time: Tt.snap,
                                        bpm: Tt.timelineBPM,
                                        offset: 0,
                                        lvlBPM: Tt.bpm,
                                    }));
                            },
                        }),
                            pt ||
                                Tt.beatNSM.pages[0].items.push({
                                    type: "number",
                                    name: "edit_tool_object_holdLength",
                                    hint: "edit_tool_object_holdLength_sub",
                                    min: 0,
                                    max: !1,
                                    bigChange: 1,
                                    smallChange: [Tt, "snap"],
                                    multiple: !0,
                                    vars: I.holdLength,
                                    update: function (e) {
                                        (e.bigChange = Xt({
                                            recieve: "raw",
                                            time: 1,
                                            bpm: Tt.timelineBPM,
                                            offset: 0,
                                            lvlBPM: Tt.bpm,
                                        })),
                                            (e.smallChange = Xt({
                                                recieve: "raw",
                                                time: Tt.snap,
                                                bpm: Tt.timelineBPM,
                                                offset: 0,
                                                lvlBPM: Tt.bpm,
                                            }));
                                    },
                                }),
                            Tt.beatNSM.pages[0].items.push({
                                type: "color",
                                name: "edit_select_item_beatColor",
                                hint: "edit_select_item_beatColor_sub",
                                mode: HSB,
                                multiple: !0,
                                hues: I.beatColor,
                                saturations: I.beatSaturation,
                                brightnesses: I.beatBrightness,
                            });
                    }
                    Tt.beatNSM.pages[0].items.push(
                        {
                            type: "button",
                            name: "edit_select_item_copy",
                            event: On,
                            hint: "edit_select_item_copy_sub",
                        },
                        {
                            type: "button",
                            name: "edit_effects_item_deselectAutomation",
                            event: function () {
                                Tt.selectedBeats = [];
                            },
                            hint: "edit_effects_item_deselectAutomation_sub",
                        }
                    ),
                        Tt.beatNSM.pages[1].items.push(
                            {
                                type: "button",
                                name: "edit_select_item_rotateCW",
                                hint: "edit_select_item_rotateCW_sub",
                                event: () => ds([2, 5, 8, 1, 4, 7, 0, 3, 6]),
                            },
                            {
                                type: "button",
                                name: "edit_select_item_rotateCCW",
                                hint: "edit_select_item_rotateCCW_sub",
                                event: () => ds([6, 3, 0, 7, 4, 1, 8, 5, 2]),
                            },
                            {
                                type: "button",
                                name: "edit_select_item_cycleCW",
                                hint: "edit_select_item_cycleCW_sub",
                                event: () => ds([1, 2, 5, 0, 4, 8, 3, 6, 7]),
                            },
                            {
                                type: "button",
                                name: "edit_select_item_cycleCCW",
                                hint: "edit_select_item_cycleCCW_sub",
                                event: () => ds([3, 0, 1, 6, 4, 2, 7, 8, 5]),
                            },
                            {
                                type: "button",
                                name: "edit_select_item_flipH",
                                hint: "edit_select_item_flipH_sub",
                                event: () => ds([2, 1, 0, 5, 4, 3, 8, 7, 6]),
                            },
                            {
                                type: "button",
                                name: "edit_select_item_flipV",
                                hint: "edit_select_item_flipV_sub",
                                event: () => ds([6, 7, 8, 3, 4, 5, 0, 1, 2]),
                            }
                        ),
                        1 === Tt.selectedBeats.length &&
                            Tt.beatNSM.pages[0].items.push({
                                type: "button",
                                name: "edit_effects_item_deleteAutomation",
                                event: function () {
                                    Tt.beat.splice(Tt.selectedBeats[0], 1),
                                        (Tt.selectedBeats = []);
                                },
                                hint: "edit_effects_item_deleteAutomation_sub",
                            }),
                        1 < Tt.selectedBeats.length &&
                            Tt.beatNSM.pages[0].items.push({
                                type: "button",
                                name: "edit_delete_multiple",
                                keys: [String(Tt.selectedBeats.length)],
                                hint: "edit_effects_item_deleteAutomation_sub",
                                event: () => {
                                    _o.activate(
                                        "edit_delete_confirmNotes",
                                        [String(Tt.selectedBeats.length)],
                                        () => {
                                            const t = Symbol();
                                            for (const e of Tt.selectedBeats)
                                                Tt.beat[e] = t;
                                            (Tt.beat = Tt.beat.filter(
                                                (e) => e !== t
                                            )),
                                                (Tt.selectedBeats = []);
                                        }
                                    );
                                },
                            }),
                        (Tt.sbeatsLast = Tt.selectedBeats.concat());
                }
                Tt.beatNSM.draw({
                    x: width - width / 4,
                    y: (height / 16) * 3,
                    width: width / 4,
                    height: (height / 16) * 10,
                    stacked: !0,
                    maxBarHeight: height / 16 / 1.25,
                    buffer: ((height / 16) * 12) / 128,
                });
            }
        } else
            fill(0, 0, 0, 200),
                rectMode(CORNER),
                noStroke(),
                rect(
                    width - width / 4,
                    (height / 16) * 3,
                    width / 2,
                    (height / 16) * 10,
                    (width < height ? width : height) / 32
                ),
                Xi(Tt.sectionsSelectedLast, Tt.sectionsSelected) ||
                    ((Tt.sectionsNSM.pages = [
                        {
                            title: "edit_sections_information",
                            items: [],
                        },
                    ]),
                    Tt.sectionsNSM.pages[0].items.push(
                        {
                            type: "number",
                            name: "edit_effects_item_startTime",
                            hint: "edit_effects_item_startTime_sub",
                            min: !1,
                            max: !1,
                            var: [Tt.sections[Tt.sectionsSelected[0]], "time"],
                            bigChange: 1,
                            smallChange: [Tt, "snap"],
                            display: function () {
                                return Xt({
                                    recieve: "bpm",
                                    time: Tt.sections[Tt.sectionsSelected[0]]
                                        .time,
                                    bpm: Tt.sections[Tt.sectionsSelected[0]]
                                        .bpm,
                                    offset: Tt.sections[Tt.sectionsSelected[0]]
                                        .offset,
                                    lvlBPM: Tt.bpm,
                                });
                            },
                            update: function (e) {
                                (e.bigChange = Xt({
                                    recieve: "raw",
                                    time: 1,
                                    bpm: Tt.sections[Tt.sectionsSelected[0]]
                                        .bpm,
                                    offset: 0,
                                    lvlBPM: Tt.bpm,
                                })),
                                    (e.smallChange = Xt({
                                        recieve: "raw",
                                        time: Tt.snap,
                                        bpm: Tt.sections[Tt.sectionsSelected[0]]
                                            .bpm,
                                        offset: 0,
                                        lvlBPM: Tt.bpm,
                                    }));
                            },
                            convert: function (e) {
                                return Xt({
                                    recieve: "raw",
                                    time: e,
                                    bpm: Tt.sections[Tt.sectionsSelected[0]]
                                        .bpm,
                                    offset: Tt.sections[Tt.sectionsSelected[0]]
                                        .offset,
                                    lvlBPM: Tt.bpm,
                                });
                            },
                        },
                        {
                            type: "number",
                            name: "edit_select_item_bpm",
                            hint: "edit_select_item_bpm_sub",
                            var: [Tt.sections[Tt.sectionsSelected[0]], "bpm"],
                            min: 0,
                            max: !1,
                            bigChange: 10,
                            smallChange: 1,
                        },
                        {
                            type: "number",
                            name: "edit_select_item_offset",
                            hint: "edit_select_item_offset_sub",
                            var: [
                                Tt.sections[Tt.sectionsSelected[0]],
                                "offset",
                            ],
                            min: !1,
                            max: !1,
                            bigChange: 10,
                            smallChange: 1,
                        },
                        {
                            type: "string",
                            name: "edit_sections_name",
                            hint: "edit_sections_name_sub",
                            var: [Tt.sections[Tt.sectionsSelected[0]], "name"],
                        },
                        {
                            type: "color",
                            name: "edit_effects_item_displayColor",
                            hint: "edit_effects_item_displayColor_sub",
                            mode: HSB,
                            hue: [Tt.sections[Tt.sectionsSelected[0]], "color"],
                            saturation: [
                                Tt.sections[Tt.sectionsSelected[0]],
                                "saturation",
                            ],
                            brightness: [
                                Tt.sections[Tt.sectionsSelected[0]],
                                "brightness",
                            ],
                        },
                        {
                            type: "boolean",
                            name: "edit_sections_visible",
                            hint: "edit_sections_visible_sub",
                            var: [
                                Tt.sections[Tt.sectionsSelected[0]],
                                "visible",
                            ],
                        },
                        {
                            type: "button",
                            name: "edit_sections_align",
                            hint: "edit_sections_align_sub",
                            event: () => {
                                var e = Tt.sectionsSelected[0];
                                void 0 !== e &&
                                    (e = Tt.sections[e]) &&
                                    ((Tt.timelineBPM = e.bpm),
                                    (Tt.timelineOffset = e.offset));
                            },
                        },
                        {
                            type: "button",
                            name: "edit_effects_item_deselectAutomation",
                            event: function () {
                                Tt.sectionsSelected = [];
                            },
                            hint: "edit_effects_item_deselectAutomation_sub",
                        },
                        {
                            type: "button",
                            name: "edit_effects_item_deleteAutomation",
                            event: function () {
                                Tt.sections.splice(Tt.sectionsSelected[0], 1),
                                    (Tt.sectionsSelected = []);
                            },
                            hint: "edit_effects_item_deleteAutomation_sub",
                        }
                    ),
                    (Tt.sectionsSelectedLast = Tt.sectionsSelected.concat())),
                Tt.sectionsNSM.draw({
                    x: width - width / 4,
                    y: (height / 16) * 3,
                    width: width / 4,
                    height: (height / 16) * 10,
                    stacked: !0,
                    maxBarHeight: height / 16 / 1.25,
                    buffer: ((height / 16) * 12) / 128,
                });
        if (
            (Tt.showGUI &&
                (fill(255, 200),
                textAlign(LEFT, BOTTOM),
                textSize(kt / 2),
                text(
                    Jt("edit_hint_keybinds_array", xt).join("\n"),
                    kt,
                    height - (height / 16 + kt)
                ),
                fill(lerp(0, 25, Tt.menuSize), lerp(200, 255, Tt.menuSize)),
                rectMode(CORNER),
                noStroke(),
                rect(
                    0,
                    height - (height / 16) * Tt.headerY,
                    width,
                    lerp((height / 16) * -(Tt.toolsH + 1), -height, Tt.menuSize)
                )),
            (Tt.tools[1][3] = []),
            0 === Tt.objType
                ? ((Tt.tools[1][0] = "edit_tool_object_beat"),
                  (Tt.tools[1][1] = St.objectBeat),
                  (Tt.tools[1][4] = "edit_tool_object_beat"))
                : ((Tt.tools[1][0] = "edit_tool_object_hold"),
                  (Tt.tools[1][1] = St.objectHold),
                  Tt.tools[1][3].push([
                      "edit_tool_object_holdLengthVal",
                      St.objectHoldTime,
                      0,
                      !1,
                      !1,
                      [Tt.holdLength],
                  ]),
                  (Tt.tools[1][4] = "edit_tool_object_hold")),
            Tt.tools[1][3].push(
                [
                    "edit_tool_object_beatColor",
                    St.beatColor,
                    0,
                    !1,
                    !1,
                    [Tt.beatColor, Tt.beatSaturation, Tt.beatBrightness],
                ],
                [
                    "edit_tool_object_transitionIn",
                    St.beatTransitionIn,
                    0,
                    !1,
                    !1,
                    [Tt.transitionNames[Tt.transitionIn]],
                ],
                [
                    "edit_tool_object_transitionOut",
                    St.beatTransitionOut,
                    0,
                    !1,
                    !1,
                    [Tt.transitionNames[Tt.transitionOut]],
                ]
            ),
            0.5 === Tt.playbackRate
                ? (Tt.tools[2][1] = St.playbackHalf)
                : (Tt.tools[2][1] = St.playbackFull),
            0 === Tt.editorMode
                ? ((Tt.tools[7][0] = "edit_tool_mode_gameplay"),
                  (Tt.tools[7][1] = St.editorModeGameplay))
                : ((Tt.tools[7][0] = "edit_tool_mode_effects"),
                  (Tt.tools[7][1] = St.editorModeEffects)),
            (Tt.tools[2][0] = "edit_tool_playback"),
            (Tt.tools[2][5] = [Tt.playbackRate]),
            void 0 !== Qt[Tt.song] && Qt[Tt.song].rate(Tt.playbackRate),
            (Tt.tools[3][0] = "edit_tool_timeline"),
            (Tt.tools[3][1] = St.timelineTools),
            (Tt.tools[3][4] = "edit_tool_timeline"),
            (Tt.tools[3][3] = []),
            Tt.tools[3][3].push(
                [
                    "edit_tool_snap",
                    St.timelineSnap,
                    0,
                    !1,
                    !1,
                    ["1/" + Ot(1 / Tt.snap)],
                ],
                ["edit_tool_bpm", St.metronome, 0, !1, !1, [Tt.timelineBPM]],
                [
                    "edit_tool_bpm_offset",
                    St.timelineOffset,
                    0,
                    !1,
                    !1,
                    [Pt("milliseconds_short", xt, Tt.timelineOffset)],
                ],
                ["edit_tool_section", St.bookmark, 0],
                ["edit_tool_timestamp", St.jumpToTimestamp, 0]
            ),
            "scroll" === Tt.timelineMode
                ? ((Tt.tools[4][0] = "edit_tool_timelineMode"),
                  (Tt.tools[4][1] = St.clickModeScroll),
                  (Tt.tools[4][5] = [Pt("edit_timelineMode_scroll", xt)]),
                  (Tt.selectedBeats = []),
                  (Tt.sectionsSelected = []))
                : "select" === Tt.timelineMode &&
                  ((Tt.tools[4][0] = "edit_tool_timelineMode"),
                  (Tt.tools[4][1] = St.clickModeSelect),
                  (Tt.tools[4][5] = [Pt("edit_timelineMode_select", xt)])),
            (Tt.saveNoticeDis += At(Tt.saveNotice, Tt.saveNoticeDis, 0.15)),
            Ot(100 * Tt.saveNoticeDis) / 100 == 1 && (Tt.saveNotice = 0),
            textAlign(RIGHT, TOP),
            fill(255),
            Dt(
                Pt("edit_menu_item_saved", xt),
                width - kt,
                height + 2 * kt - Tt.saveNoticeDis * (6 * kt),
                width,
                kt
            ),
            !1 === Tt.menu)
        ) {
            if (((Tt.saved = !1), Tt.showGUI))
                for (i = 0; i < Tt.tools.length; i++) {
                    if (
                        (Ft(
                            "rcorner",
                            (width / Tt.tools.length) * i,
                            height - (height / 16) * Tt.headerY,
                            width / Tt.tools.length,
                            (height / 16) *
                                -(Tt.toolsH + 1) *
                                (!1 !== Tt.tools[i][3]
                                    ? +Tt.tools[i][2] + 1
                                    : 1)
                        )
                            ? (Tt.tools[i][2] += At(1, Tt.tools[i][2], 0.2))
                            : (Tt.tools[i][2] += At(0, Tt.tools[i][2], 0.1)),
                        !1 !== Tt.tools[i][3])
                    )
                        for (pt = !1, t = 0; t < Tt.tools[i][3].length + 1; t++)
                            t < Tt.tools[i][3].length
                                ? Ft(
                                      "rcorner",
                                      (width / Tt.tools.length) * i +
                                          (width /
                                              Tt.tools.length /
                                              Tt.tools[i][3].length) *
                                              t,
                                      height -
                                          (height / 32) *
                                              (Tt.toolsH + 1) *
                                              (4 * Tt.tools[i][2]),
                                      width /
                                          Tt.tools.length /
                                          Tt.tools[i][3].length,
                                      (height / 16) * (Tt.toolsH + 1)
                                  )
                                    ? ((Tt.tools[i][3][t][2] += At(
                                          1,
                                          Tt.tools[i][3][t][2],
                                          0.2
                                      )),
                                      (Tt.tools[i][0] = Tt.tools[i][3][t][0]),
                                      (Tt.tools[i][5] = Tt.tools[i][3][t][5]),
                                      (pt = !0))
                                    : (Tt.tools[i][3][t][2] += At(
                                          0,
                                          Tt.tools[i][3][t][2],
                                          0.2
                                      ))
                                : !1 === pt &&
                                  (Tt.tools[i][0] = Tt.tools[i][4]);
                    textSize((height / 32) * (Tt.toolsH + 1));
                    var bt = "",
                        bt =
                            void 0 !== Tt.tools[i][5]
                                ? Pt(
                                      Tt.tools[i][0],
                                      xt,
                                      Tt.tools[i][5][0],
                                      Tt.tools[i][5][1],
                                      Tt.tools[i][5][2],
                                      Tt.tools[i][5][3],
                                      Tt.tools[i][5][4]
                                  )
                                : Pt(Tt.tools[i][0], xt),
                        wt = (width / Tt.tools.length) * i,
                        Ct = textWidth(bt) + (height / 32) * (Tt.toolsH + 1),
                        yt = 1;
                    if (
                        ((wt =
                            wt < ((height / 32) * (Tt.toolsH + 1)) / 2
                                ? ((height / 32) * (Tt.toolsH + 1)) / 2
                                : wt) +
                            Ct >
                            width - ((height / 32) * (Tt.toolsH + 1)) / 2 &&
                            (wt =
                                width -
                                ((height / 32) * (Tt.toolsH + 1)) / 2 -
                                Ct),
                        !1 !== Tt.tools[i][3] && (yt = 1.5),
                        fill(25, 255),
                        ellipseMode(CORNER),
                        rect(
                            wt,
                            height -
                                (height / 32) *
                                    (Tt.toolsH + 1) *
                                    (4 * yt * Tt.tools[i][2]),
                            Ct,
                            (height / 32) * (Tt.toolsH + 1) * 1.5,
                            (height / 32) * (Tt.toolsH + 1) * 2
                        ),
                        fill(255),
                        textAlign(CENTER, CENTER),
                        text(
                            bt,
                            wt +
                                (textWidth(bt) +
                                    (height / 32) * (Tt.toolsH + 1)) /
                                    2,
                            height -
                                (height / 32) *
                                    (Tt.toolsH + 1) *
                                    (4 * yt * Tt.tools[i][2]) +
                                ((height / 32) * (Tt.toolsH + 1) * 1.5) / 2
                        ),
                        !1 !== Tt.tools[i][3])
                    ) {
                        rectMode(CORNER),
                            fill(0, 200 * Tt.tools[i][2]),
                            rect(
                                (width / Tt.tools.length) * i,
                                height -
                                    (height / 32) *
                                        (Tt.toolsH + 1) *
                                        (4 * Tt.tools[i][2]),
                                width / Tt.tools.length,
                                (height / 16) * (Tt.toolsH + 1)
                            );
                        for (t = 0; t < Tt.tools[i][3].length; t++)
                            fill(
                                25,
                                255 *
                                    Tt.tools[i][3][t][2] *
                                    Tt.tools[i][3].length
                            ),
                                rect(
                                    (width / Tt.tools.length) * i +
                                        (width /
                                            Tt.tools.length /
                                            Tt.tools[i][3].length) *
                                            t,
                                    height -
                                        (height / 32) *
                                            (Tt.toolsH + 1) *
                                            (4 * Tt.tools[i][2]),
                                    width /
                                        Tt.tools.length /
                                        Tt.tools[i][3].length,
                                    (height / 16) * (Tt.toolsH + 1)
                                ),
                                imageMode(CENTER),
                                smooth(),
                                image(
                                    Tt.tools[i][3][t][1],
                                    (width / Tt.tools.length) * i +
                                        (width /
                                            Tt.tools.length /
                                            Tt.tools[i][3].length) *
                                            t +
                                        width /
                                            Tt.tools.length /
                                            Tt.tools[i][3].length /
                                            2,
                                    height -
                                        (height / 32) *
                                            (Tt.toolsH + 1) *
                                            (4 * Tt.tools[i][2]) +
                                        ((height / 16) * (Tt.toolsH + 1)) / 2,
                                    ((height / 16) * -(Tt.toolsH + 1)) / 1.5,
                                    ((height / 16) * -(Tt.toolsH + 1)) / 1.5
                                );
                    }
                    rectMode(CORNER),
                        fill(25, 255 * Tt.tools[i][2]),
                        rect(
                            (width / Tt.tools.length) * i,
                            height - (height / 16) * Tt.headerY,
                            width / Tt.tools.length,
                            (height / 16) * -(Tt.toolsH + 1)
                        ),
                        imageMode(CENTER),
                        image(
                            Tt.tools[i][1],
                            (width / Tt.tools.length) * i +
                                width / Tt.tools.length / 2,
                            height -
                                (height / 16) * Tt.headerY +
                                ((height / 16) * -(Tt.toolsH + 1)) / 2,
                            ((height / 16) * -(Tt.toolsH + 1)) / 1.5,
                            ((height / 16) * -(Tt.toolsH + 1)) / 1.5
                        );
                }
        } else
            Tt.playing && en(),
                rectMode(CORNER),
                Tt.menuNSM.draw({
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                    stacked: !1,
                    maxBarHeight: height / 15,
                    buffer: (height - height / 16) / 64,
                }),
                (Tt.ar = (Tt.bpm / 60 / 2) * Tt.oldAr),
                (Tt.arInit = Tt.ar),
                push(),
                translate(
                    width *
                        (1 -
                            (Tt.menuHLX / (width / (Tt.menuItems.length + 1)) -
                                1)),
                    0
                ),
                textAlign(CENTER, CENTER),
                fill(255),
                !0 !== Lt(Tt.song, "id").error &&
                    void 0 === Qt[Tt.song] &&
                    ((ei = ti = !1), ho(Tt.song)),
                pop(),
                rectMode(CENTER),
                fill(255),
                rect(
                    (width / Tt.tools.length) * (Tt.tools.length - 1) +
                        width / Tt.tools.length / 2,
                    height - height / 16 + height / 16 / 2,
                    width / Tt.tools.length,
                    height / 16,
                    height / 64,
                    0,
                    0,
                    0
                ),
                fill(0),
                textAlign(CENTER, CENTER),
                Dt(
                    Pt("menu_close", xt),
                    (width / Tt.tools.length) * (Tt.tools.length - 1) +
                        width / Tt.tools.length / 2,
                    height - height / 16 + height / 16 / 2,
                    (width / Tt.tools.length) * 0.75,
                    (height / 16) * 0.75
                ),
                Tt.exiting &&
                    (rectMode(CORNER),
                    fill(0, 200),
                    rect(0, 0, width, height),
                    textAlign(CENTER, CENTER),
                    fill(255),
                    Dt(
                        Pt("edit_menu_item_confirmExit", xt),
                        width / 2,
                        (height / 4) * 1.5,
                        width / 1.5,
                        height / 4
                    ),
                    (H = (width / 2 - 2 * kt) / 1.5),
                    (R = height / 4 / 1.5),
                    Kt(
                        width / 4 - H / 2,
                        (height / 4) * 2.5 - R / 4,
                        H,
                        R,
                        Pt("edit_menu_item_confirmExit_yes", xt),
                        Tt.buttonHover,
                        2
                    ),
                    Kt(
                        (width / 4) * 3 - H / 2,
                        (height / 4) * 2.5 - R / 4,
                        H,
                        R,
                        Pt("edit_menu_item_confirmExit_no", xt),
                        Tt.buttonHover,
                        3
                    ));
        if (
            (qt &&
                ((Rt = []),
                (Rt = Uo(Ht.saved, "dateDesc")),
                Yi(Ht.saved.indexOf(Rt[Tt.lvlSel])),
                (qt = !1)),
            Zt &&
                !1 === Tt.menu &&
                !Nt.active &&
                (0 === Tt.editorMode
                    ? (0 < Tt.selectedBeats.length ? On : Nn)()
                    : 1 === Tt.editorMode &&
                      (0 < Tt.effectMultiSel.length ? On : Nn)(),
                (Zt = !1)),
            jt && !1 === Tt.menu && !Nt.active && (zn(), (jt = !1)),
            0 !== Mt())
        )
            for (var Et = Ot(Mt() / 33 / 4), i = 0; i < abs(Et); i++)
                qn(Et < 0 ? "LEFT" : "RIGHT", Gt, Yt);
        (Vt *= 0.25),
            colorMode(HSB),
            fill(Tt.beatColor, Tt.beatSaturation, Tt.beatBrightness, 200),
            "scroll" === Tt.timelineMode && 0 === Tt.editorMode
                ? 0 === Tt.objType
                    ? rect(
                          mouseX - 0.5 * kt,
                          mouseY + 0.625 * kt,
                          kt / 3,
                          kt / 3
                      )
                    : 1 === Tt.objType &&
                      (ellipseMode(CORNER),
                      ellipse(
                          mouseX - 0.5 * kt,
                          mouseY + 0.625 * kt,
                          kt / 3,
                          kt / 3
                      ),
                      textAlign(RIGHT, CENTER),
                      textSize(kt / 2),
                      text(
                          Tt.holdLength,
                          mouseX - 0.75 * kt,
                          mouseY + 0.625 * kt + kt / 3 / 2
                      ))
                : "select" === Tt.timelineMode &&
                  (colorMode(RGB),
                  fill(255),
                  imageMode(CORNER),
                  image(
                      St.select,
                      mouseX - 0.5 * kt,
                      mouseY + 0.625 * kt,
                      kt / 3,
                      kt / 3
                  ),
                  textAlign(RIGHT, CENTER),
                  textSize(kt / 2),
                  0 < Tt.selectedBeats.length && 0 === Tt.editorMode
                      ? text(
                            Tt.selectedBeats.length,
                            mouseX - 0.75 * kt,
                            mouseY + 0.625 * kt + kt / 3 / 2
                        )
                      : 0 < Tt.effectMultiSel.length && 1 === Tt.editorMode
                      ? text(
                            Tt.effectMultiSel.length,
                            mouseX - 0.75 * kt,
                            mouseY + 0.625 * kt + kt / 3 / 2
                        )
                      : 0 < Tt.sectionsSelected.length &&
                        text(
                            Tt.sectionsSelected.length,
                            mouseX - 0.75 * kt,
                            mouseY + 0.625 * kt + kt / 3 / 2
                        ));
    }
    colorMode(RGB);
};

// !!! Standardize mods

function qi(e, t, i) {
    // --- EDITED CODE (Start map only if all users are ready)
    if (multiplayer.code != "") {
        (Tt.mods.auto = false),
            (Tt.mods.random = false),
            (Tt.mods.noFail = true),
            (Tt.mods.instantFail = false),
            (Tt.mods.perfect = false),
            (Tt.mods.startPos = 0),
            (Tt.mods.endPos = 0);

        for (const curUser of Object.values(multiplayer.roomUsers)) {
            if (!curUser.host && !curUser.ready && curUser.uuid != T.uuid) {
                console.log(curUser);
                Gn({
                    type: "error",
                    message: "multiplayer_readyError",
                });
                return;
            }
        }
    }
    if (
        ("new" !== t
            ? ((Rt = []), (Rt = Uo(Ht.search, Bt.lvl.sortMode)))
            : ((Rt = Uo(Ht.saved, "dateDesc")),
              (Bt.lvl.tab = 0),
              (Bt.lvl.sortMode = "dateDesc"),
              (Bt.lvl.sel = e),
              (Bt.lvl.search = "")),
        (Tt.timelineBPM = !1),
        (Tt.timelineOffset = !1),
        !(multiplayer.code !== "") === Rt[e]?.local)
    ) {
        (Tt.title = Rt[e].title),
            (Tt.author = Rt[e].author),
            (Tt.bpm = Rt[e].bpm);
        var o = [!1, !1];
        Tt.beat = [];
        for (var n = 0; n < Rt[e].beat.length; n++) {
            Tt.beat[n] = [];
            for (var s = 0; s < Rt[e].beat[n].length; s++)
                Tt.beat[n][s] = Rt[e].beat[n][s];
            void 0 === Tt.beat[n][9] &&
                ((Tt.bpm = 120),
                (Tt.beat[n][9] = Rt[e].bpm),
                (Tt.beat[n][1] = Tt.beat[n][1] * (120 / Tt.beat[n][9])),
                (Tt.beat[n][6] = Tt.beat[n][6] * (120 / Tt.beat[n][9]))),
                void 0 === Tt.beat[n][10] && (Tt.beat[n][10] = 0),
                void 0 === Tt.beat[n][11] && (Tt.beat[n][11] = 141),
                (void 0 !== Tt.beat[n][13] && null !== Tt.beat[n][13]) ||
                    (Tt.beat[n][13] = 0),
                (void 0 !== Tt.beat[n][14] && null !== Tt.beat[n][14]) ||
                    (Tt.beat[n][14] = 3),
                (Tt.beat[n][1] < o[0] || !1 === o[0]) &&
                    ((o[0] = Tt.beat[n][1]), (o[1] = n));
        }
        if (
            (!1 !== o[1] &&
                ((Tt.timelineBPM = Tt.beat[o[1]][9]),
                (Tt.timelineOffset = Tt.beat[o[1]][10])),
            (Tt.oldAr = Rt[e].ar),
            (Tt.hw = Rt[e].hw),
            (Tt.hpD = Rt[e].hpD),
            (Tt.song = Rt[e].song),
            (Tt.bg = Rt[e].bg),
            (Tt.songOffset =
                void 0 === Rt[e].songOffset ? 0 : Rt[e].songOffset),
            (Tt.title = Rt[e].title),
            (Tt.desc = Rt[e].desc),
            (Tt.stars = Bn(Rt[e])), // SCARY!!
            (Tt.gameVersion = Rt[e].gameVersion),
            (Tt.lvlSel = e),
            (Tt.effects = []),
            void 0 !== Rt[e].effects &&
                null !== Rt[e].effects &&
                0 < Rt[e].effects.length)
        ) {
            Tt.effects = JSON.parse(JSON.stringify(Rt[e].effects));
            for (n = 0; n < Rt[e].effects.length; n++)
                void 0 === Tt.effects[n].bpm &&
                    ((Tt.bpm = 120),
                    (Tt.effects[n].bpm = Rt[e].bpm),
                    (Tt.effects[n].time =
                        Tt.effects[n].time * (120 / Tt.effects[n].bpm)),
                    (Tt.effects[n].moveTime =
                        Tt.effects[n].moveTime * (120 / Tt.effects[n].bpm))),
                    void 0 === Tt.effects[n].offset &&
                        (Tt.effects[n].offset = 0);
        }
        if (
            ((Tt.sections = []),
            void 0 !== Rt[e].sections &&
                null !== Rt[e].sections &&
                0 < Rt[e].sections.length)
        ) {
            Tt.sections = JSON.parse(JSON.stringify(Rt[e].sections));
            for (n = 0; n < Rt[e].sections.length; n++)
                void 0 === Tt.sections[n].bpm &&
                    ((Tt.bpm = 120),
                    (Tt.sections[n].bpm = Rt[e].bpm),
                    (Tt.sections[n].time =
                        Tt.sections[n].time * (120 / Tt.sections[n].bpm))),
                    void 0 === Tt.sections[n].offset &&
                        (Tt.sections[n].offset = 0);
        }
    } else {
        (Tt.title = m(Rt[e], "id").title),
            (Tt.author = m(Rt[e], "id").author),
            (Tt.beat = []),
            (Tt.bpm = m(Rt[e], "id").bpm);
        for (n = 0; n < m(Rt[e], "id").beat.length; n++) {
            Tt.beat[n] = [];
            for (s = 0; s < m(Rt[e], "id").beat[n].length; s++)
                Tt.beat[n][s] = m(Rt[e], "id").beat[n][s];
            void 0 === Tt.beat[n][9] &&
                ((Tt.bpm = 120),
                (Tt.beat[n][9] = m(Rt[e], "id").bpm),
                (Tt.beat[n][1] = Tt.beat[n][1] * (120 / Tt.beat[n][9])),
                (Tt.beat[n][6] = Tt.beat[n][6] * (120 / Tt.beat[n][9]))),
                void 0 === Tt.beat[n][10] && (Tt.beat[n][10] = 0),
                void 0 === Tt.beat[n][11] && (Tt.beat[n][11] = 141),
                (void 0 !== Tt.beat[n][13] && null !== Tt.beat[n][13]) ||
                    (Tt.beat[n][13] = 0),
                (void 0 !== Tt.beat[n][14] && null !== Tt.beat[n][14]) ||
                    (Tt.beat[n][14] = 3);
        }
        if (
            ((Tt.oldAr = m(Rt[e], "id").ar),
            (Tt.hw = m(Rt[e], "id").hw),
            (Tt.hpD = m(Rt[e], "id").hpD),
            (Tt.song = m(Rt[e], "id").song),
            (Tt.bg = m(Rt[e], "id").bg),
            (Tt.songOffset =
                null === m(Rt[e], "id").songOffset
                    ? 0
                    : m(Rt[e], "id").songOffset),
            (Tt.title = m(Rt[e], "id").title),
            (Tt.desc = m(Rt[e], "id").desc),
            (Tt.stars = Bn(Rt[e])), // SCARY!!
            (Tt.gameVersion = m(Rt[e], "id").gameVersion),
            (Tt.lvlSel = e),
            void 0 === m(Rt[e], "id").effects ||
                null === m(Rt[e], "id").effects)
        )
            Tt.effects = [];
        else {
            Tt.effects = [];
            for (n = 0; n < m(Rt[e], "id").effects.length; n++) {
                for (var r in ((Tt.effects[n] = []), m(Rt[e], "id").effects[n]))
                    Tt.effects[n][r] = m(Rt[e], "id").effects[n][r];
                void 0 === Tt.effects[n].bpm &&
                    ((Tt.bpm = 120),
                    (Tt.effects[n].bpm = m(Rt[e], "id").bpm),
                    (Tt.effects[n].time =
                        Tt.effects[n].time * (120 / Tt.effects[n].bpm)),
                    (Tt.effects[n].moveTime =
                        Tt.effects[n].moveTime * (120 / Tt.effects[n].bpm))),
                    void 0 === Tt.effects[n].offset &&
                        (Tt.effects[n].offset = 0);
            }
        }
        if (
            void 0 === m(Rt[e], "id").sections ||
            null === m(Rt[e], "id").sections
        )
            Tt.sections = [];
        else {
            Tt.sections = [];
            for (n = 0; n < m(Rt[e], "id").sections.length; n++) {
                for (var r in ((Tt.sections[n] = []),
                m(Rt[e], "id").sections[n]))
                    Tt.sections[n][r] = m(Rt[e], "id").sections[n][r];
                void 0 === Tt.sections[n].bpm &&
                    ((Tt.bpm = 120),
                    (Tt.sections[n].bpm = m(Rt[e], "id").bpm),
                    (Tt.sections[n].time =
                        Tt.sections[n].time * (120 / Tt.sections[n].bpm))),
                    void 0 === Tt.sections[n].offset &&
                        (Tt.sections[n].offset = 0);
            }
        }
    }
    (void 0 !== Tt.hw && null !== Tt.hw) || (Tt.hw = Tt.oldAr),
        Tt.beat.sort(function (e, t) {
            return e[1] - t[1];
        });
    for (n = Tt.beat.length - 1; 0 <= n; n--)
        (isNaN(Tt.beat[n][0]) ||
            isNaN(Tt.beat[n][1]) ||
            null === Tt.beat[n][0] ||
            null === Tt.beat[n][1]) &&
            Tt.beat.splice(n, 1),
            void 0 === Tt.beat[n][16] && (Tt.beat[n][16] = 255),
            void 0 === Tt.beat[n][17] && (Tt.beat[n][17] = 255);
    Tt.effects.sort(function (e, t) {
        return e.time - t.time;
    }),
        Tt.sections.sort(function (e, t) {
            return e.time - t.time;
        });
    for (n = Tt.sections.length - 1; 0 <= n; n--)
        void 0 === Tt.sections[n].saturation &&
            (Tt.sections[n].saturation = 255),
            void 0 === Tt.sections[n].brightness &&
                (Tt.sections[n].brightness = 255);
    if (!1 === Tt.edit)
        for (n = Tt.sections.length - 1; 0 <= n; n--)
            !1 === Tt.sections[n].visible && Tt.sections.splice(n, 1);
    Tt.overlayGraphics = {
        wide: [],
        normal: [],
    };
    for (
        var h = [],
            h =
                2 !== Bt.settings.keyboard
                    ? Tt.keyDisplay[Bt.settings.language]
                    : Tt.keyDisplayNum,
            n = 0;
        n < 9;
        n++
    ) {
        var a = 2 * ceil((width < height ? height : width) / 24 / 2);
        (Tt.overlayGraphics.normal[n] = createGraphics(a, a, P2D)),
            Tt.overlayGraphics.normal[n].background(0, 0),
            Tt.overlayGraphics.normal[n].textAlign(CENTER, CENTER),
            Tt.overlayGraphics.normal[n].fill(255),
            Tt.overlayGraphics.normal[n].noStroke(),
            Tt.overlayGraphics.normal[n].strokeWeight(0),
            Tt.overlayGraphics.normal[n].textFont(Ee),
            Tt.overlayGraphics.normal[n].textSize(a),
            Tt.overlayGraphics.normal[n].text(h[n], a / 2, a / 2);
    }
    if (
        ((Ie = height < width ? height / 4 : width / 4),
        (Ae = height < width ? height / 4 : width / 4),
        (u.boxR = 0),
        (Tt.lineFade = 0),
        (Tt.loaded = !1),
        (u.dropTime = 0),
        (u.finished = !1),
        (Tt.disMode = 0),
        !1 === Tt.edit ? (Tt.time = "set") : !0 === Tt.edit && (Tt.time = 0),
        (Tt.timeStart = !1),
        (Tt.next = []),
        (Tt.prt = []),
        (Tt.songPlaying = !1),
        (Tt.hp = 100),
        (Tt.hpDis = 100),
        (Tt.hpPerm = []),
        (Tt.hpPermScan = [0, 0]),
        (Tt.keysHeld = [!1, !1, !1, !1, !1, !1, !1, !1, !1]),
        (Tt.score = 0),
        (Tt.scoreDis = 0),
        (Tt.combo = 0),
        (Tt.comboMax = 0),
        (Tt.hitStats = [0, 0, 0, 0]),
        (Tt.winEase = [0, 0, 0, 0]),
        (Tt.acc = 100),
        (Tt.accDis = 0),
        (Tt.accScore = 0),
        (Tt.accHits = 0),
        (Tt.missPrt = []),
        (Tt.missTiles = [
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
        ]),
        (Tt.headerY = 0),
        (u.finishFade = 0),
        (Tt.transBackA = 255),
        (Tt.board.str = 0),
        (Tt.failed = !1),
        (Tt.paused = false),
        (Tt.playingOffset = 0),
        (Tt.resumeTime = !1),
        (Tt.playbackRate = 1),
        (Tt.scoreSubmitted = !1),
        (Tt.selectedBeats = []),
        (Tt.saved = !1),
        (Tt.menu = !1),
        (Tt.exiting = !1),
        (Tt.hitError = []),
        (Tt.ctrlHeld = !1),
        (Tt.shiftHeld = !1),
        (Tt.keysPressed = [!1, !1, !1, !1, !1, !1, !1, !1, !1]),
        (Tt.tilePress = [0, 0, 0, 0, 0, 0, 0, 0, 0]),
        (Tt.tilePressDis = [0, 0, 0, 0, 0, 0, 0, 0, 0]),
        (Tt.tilePressRelease = [!0, !0, !0, !0, !0, !0, !0, !0, !0]),
        (Tt.lastHitTile = 4),
        (Tt.newScore.cur = 0),
        (Tt.newScore.curMult = 0),
        (Tt.newScore.past = 0),
        (Tt.newScore.miss = 1),
        (Tt.newScore.log = []),
        (Tt.newScore.press = []),
        (Tt.newScore.release = []),
        (Tt.replay.pressI = 0),
        (Tt.replay.releaseI = 0),
        (Tt.replay.logI = 0),
        (Tt.selectedBeats = []),
        (Tt.selectedBeatsLast = []),
        (Tt.effectMultiSel = []),
        (Tt.effectMultiSelLast = []),
        (Tt.effectClipboard = []),
        (Tt.beatClipboard = []),
        (Tt.transitionIn = 0),
        (Tt.transitionOut = 3),
        (Tt.beatColor = 141),
        (Tt.beatSaturation = 255),
        (Tt.beatBrightness = 255),
        (Tt.metronomeFlip = !1),
        (Tt.drawEffects = []),
        (Tt.queueEditorMusic = !1),
        (Tt.effectsFinished = []),
        (Tt.effectsCache = {}),
        (Tt.lastPrt = void 0),
        (Tt.preLevelStart = !1),
        (Tt.sectionsSelected = []),
        (Tt.sectionsSelectedLast = []),
        (Tt.newHits = []),
        (Tt.outroTimer = !1),
        (Tt.sectionPerformance = []),
        (Tt.sectionAcc = []),
        (Tt.endMillis = !1),
        (Tt.performanceChart = !1),
        (Tt.sectionCarouselIndex = 0),
        (Tt.sectionBarWidth = 0),
        (Tt.tileTrail = []),
        (Tt.tileTrailLast = [0, 0, 0, 0, 0, 0, 0, 0, 0]),
        Tt.retry
            ? Tt.quickRetry
                ? ((Tt.preLevelStart = millis() - 5e3 + 1e3),
                  (Tt.playingOffset = (-1 / 60) * Tt.bpm))
                : (Tt.preLevelStart = millis() - 5e3 + 2e3)
            : (Tt.preLevelStart = millis() - 5e3 + 5e3),
        (Tt.songEnded = !1) === Tt.timelineBPM &&
            !1 === Tt.timelineOffset &&
            ((Tt.timelineBPM = 120), (Tt.timelineOffset = 0)),
        void 0 !== Bt.lvl.prevPlay &&
            void 0 !== Qt[Bt.lvl.prevPlay] &&
            (soundManager.stop(Bt.lvl.prevPlay), Qt[Bt.lvl.prevPlay].stop()),
        soundManager.stop(Tt.song),
        soundManager.setVolume(Tt.song, Bt.settings.musicVolume),
        soundManager.setPlaybackRate(Tt.song, 1),
        void 0 !== Qt[Tt.song] &&
            (Qt[Tt.song].stop(),
            Qt[Tt.song].volume(Bt.settings.musicVolume / 100),
            Qt[Tt.song].rate(1)),
        (ti = ei = !1),
        Tt.edit)
    )
        for (var r in Tt.mods) Tt.mods[r] = Tt.modsDef[r];
    else {
        if (
            (soundManager.setPlaybackRate(Tt.song, Tt.mods.bpm),
            (Tt.bpm *= Tt.mods.bpm),
            (Tt.oldAr *= Tt.mods.foresight),
            (Tt.hw *= Tt.mods.hitWindow),
            Tt.mods.random)
        )
            for (n = 0; n < Tt.beat.length; n++) Tt.beat[n][0] = Ot(L(0, 8));
        else if (Tt.mods.mirror) {
            for (n = 0; n < Tt.beat.length; n++)
                0 === Tt.beat[n][0]
                    ? (Tt.beat[n][0] = 2)
                    : 2 === Tt.beat[n][0]
                    ? (Tt.beat[n][0] = 0)
                    : 3 === Tt.beat[n][0]
                    ? (Tt.beat[n][0] = 5)
                    : 5 === Tt.beat[n][0]
                    ? (Tt.beat[n][0] = 3)
                    : 6 === Tt.beat[n][0]
                    ? (Tt.beat[n][0] = 8)
                    : 8 === Tt.beat[n][0] && (Tt.beat[n][0] = 6);
            for (n = 0; n < Tt.effects.length; n++)
                (Tt.effects[n].moveX = -Tt.effects[n].moveX),
                    (Tt.effects[n].moveD = -Tt.effects[n].moveD),
                    0 === Tt.effects[n].tileID
                        ? (Tt.effects[n].tileID = 2)
                        : 2 === Tt.effects[n].tileID
                        ? (Tt.effects[n].tileID = 0)
                        : 3 === Tt.effects[n].tileID
                        ? (Tt.effects[n].tileID = 5)
                        : 5 === Tt.effects[n].tileID
                        ? (Tt.effects[n].tileID = 3)
                        : 6 === Tt.effects[n].tileID
                        ? (Tt.effects[n].tileID = 8)
                        : 8 === Tt.effects[n].tileID &&
                          (Tt.effects[n].tileID = 6);
        }
        if (0 !== Tt.mods.startPos) {
            var l = Tt.bpm * (Tt.mods.startPos / Tt.mods.bpm / 1e3 / 60);
            for (const g of Tt.beat) g[1] -= l;
            Tt.beat = Tt.beat.filter((e) => -1e-5 <= e[1]);
            for (const d of Tt.effects) d.time -= l;
            for (const c of Tt.sections) c.time -= l;
            Tt.songOffset += Tt.mods.startPos;
        }
        if (0 !== Tt.mods.endPos) {
            const f =
                Tt.bpm *
                ((Tt.mods.endPos - Tt.mods.startPos) / Tt.mods.bpm / 1e3 / 60);
            Tt.beat = Tt.beat.filter((e) => e[1] <= 1e-5 + f);
        }
    }
    if (
        ((Tt.timeEnd = Mi()),
        (Tt.scoreMax = 100 * Tt.beat.length * 10),
        (Tt.ar = (Tt.bpm / 60 / 2) * Tt.oldAr),
        (Tt.arInit = Tt.ar),
        (Tt.hw = (Tt.bpm / 60 / 2) * Tt.hw),
        "new" === t &&
            ((Rt = Uo(Ht.saved, "dateDesc")), (Bt.lvl.searchSent = !1)),
        void 0 === Tt.gameVersion || Tt.gameVersion < 4)
    )
        for (n = 0; n < Tt.effects.length; n++) {
            var d = Tt.effects[n];
            void 0 !== d.tileID &&
                !1 === Array.isArray(d.tileID) &&
                (!1 === isNaN(d.tileID)
                    ? (d.tileID = [constrain(d.tileID, 0, 9)])
                    : (d.tileID = [])),
                9 === d.type &&
                    (void 0 === d.backgroundAlpha &&
                        (void 0 !== d.transparency
                            ? ((d.backgroundAlpha = d.transparency),
                              (d.highlightAlpha = d.transparency),
                              (d.targetBackgroundAlpha =
                                  d.transparency + d.moveTransparency),
                              (d.targetHighlightAlpha =
                                  d.transparency + d.moveTransparency))
                            : ((d.backgroundAlpha = 255),
                              (d.highlightAlpha = 255),
                              (d.targetBackgroundAlpha = 255),
                              (d.targetHighlightAlpha = 255))),
                    void 0 === d.targetHighlightColor &&
                        (void 0 !== d.moveHighlightColor
                            ? ((d.targetHighlightColor =
                                  d.highlightColor + d.moveHighlightColor),
                              255 < d.targetHighlightColor &&
                                  ((d.targetHighlightLoops = floor(
                                      d.targetHighlightColor / 255
                                  )),
                                  (d.targetHighlightColor =
                                      d.targetHighlightColor % 255),
                                  (d.targetHighlightSmooth = !1)),
                              (d.moveHighlightColor = void 0))
                            : ((d.targetHighlightLoops = 0),
                              (d.targetHighlightColor = d.highlightColor),
                              (d.targetHighlightSmooth = !1))),
                    void 0 === d.highlightSaturation) &&
                    ((d.highlightSaturation = 255),
                    (d.targetHighlightSaturation = 255),
                    (d.highlightBrightness = 255),
                    (d.targetHighlightBrightness = 255),
                    (d.backgroundColor = 141),
                    (d.targetBackgroundColor = 141),
                    (d.backgroundSaturation = 0),
                    (d.targetBackgroundSaturation = 0),
                    (d.backgroundBrightness = 255),
                    (d.targetBackgroundBrightness = 255)),
                void 0 === d.displaySaturation &&
                    ((d.displaySaturation = 255), (d.displayBrightness = 255));
        }
    for (n = 0; n < Tt.effects.length; n++) {
        d = Tt.effects[n];
        14 === d.type &&
            ((null !== d.trailLength && void 0 !== d.trailLength) ||
                (d.trailLength = 0),
            (null !== d.trailSpacing && void 0 !== d.trailSpacing) ||
                (d.trailSpacing = 0),
            (null !== d.trailAlpha && void 0 !== d.trailAlpha) ||
                (d.trailAlpha = 0),
            (null !== d.trailDelete && void 0 !== d.trailDelete) ||
                (d.trailDelete = !1),
            (null !== d.trailColor && void 0 !== d.trailColor) ||
                (d.trailColor = !0));
    }
    !(Tt.submittedScore = null) !== i &&
        (Vi("game", "menu"), (Bt.lvl.loading = !0));
}

// !!! Add fs.screens

fs.screens = function () {
    if (
        ("click" === He && 3e3 <= millis() && fs.screens.click(), "menu" === He)
    )
        if (
            ("logo" === Bt.screen && fs.screens.logo(),
            "logo" !== Bt.screen &&
                "main trans" !== Bt.screen &&
                fs.screens.header(),
            !0 === Bt.side)
        )
            fs.screens.nav();
        else if ("account" === Bt.screen && "" === T.uuid)
            fs.screens.accountSignedOut();
        else if ("account" === Bt.screen) fs.screens.accountSignedIn();
        else if ("lvl" === Bt.screen && !1 === Bt.lvl.loading && !0 !== Ne) {
            (Rt = []), (Rt = Uo(Ht.search, Bt.lvl.sortMode));
            for (var e = 0; e < Rt.length; e++)
                (i =
                    height / 16 +
                    height / 24 +
                    (height / 12) * e -
                    (Rt.length >
                    (height - (height / 16 + height / 24)) / (height / 12)
                        ? (Bt.lvl.scroll /
                              (height -
                                  (height / 16 + height / 24) -
                                  (height - (height / 16 + height / 24)) /
                                      12)) *
                          ((height / 12) *
                              (Rt.length -
                                  (height - (height / 16 + height / 24)) /
                                      (height / 12)))
                        : 0)) < height &&
                    0 < i &&
                    (width > height ? width : height,
                    Ft("rcorner", 0, i, width / 3 - width / 48, height / 12)) &&
                    ((Bt.lvl.sel = e),
                    !(Bt.lvl.deleteConfirm = !1) === Rt[e].local
                        ? (Tt.mods.offset =
                              Ht.localOffsets[Ht.saved.indexOf(Rt[e])])
                        : (Tt.mods.offset = Ht.onlineOffsets[Rt[e]]),
                    (void 0 !== Tt.mods.offset && null !== Tt.mods.offset) ||
                        (Tt.mods.offset = 0));
            if (!1 !== Bt.lvl.sel)
                if (!1 === Bt.lvl.deleteConfirm && !1 === Bt.lvl.uploadConfirm)
                    if (Bt.lvl.showMods)
                        if (vt.active) vt.callback?.();
                        else {
                            if (
                                (Ft(
                                    "rcorner",
                                    width / 3 +
                                        kt +
                                        (((width / 3) * 2 - 2 * kt) / 2 +
                                            kt / 2),
                                    height / 16 +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 / 3) * 2 +
                                        kt / 2 +
                                        (((height - height / 16) / 3 / 3 -
                                            kt / 2) /
                                            4) *
                                            3 -
                                        kt / 2,
                                    ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                    ((height - height / 16) / 3 / 3 - kt / 2) /
                                        2
                                ) &&
                                    ((Bt.lvl.buttonHover[11] /= 4),
                                    (Bt.lvl.showMods = !Bt.lvl.showMods)),
                                Ft(
                                    "rcorner",
                                    width / 3 +
                                        kt +
                                        (((width / 3) * 2 - 2 * kt) / 2 +
                                            kt / 2),
                                    height / 16 +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 / 3) * 2 +
                                        kt / 2 +
                                        (((height - height / 16) / 3 / 3 -
                                            kt / 2) /
                                            4) *
                                            3 -
                                        kt / 2 -
                                        ((height - height / 16) / 3 / 3 -
                                            kt / 2) /
                                            2 -
                                        kt / 2,
                                    ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                    ((height - height / 16) / 3 / 3 - kt / 2) /
                                        2
                                ) &&
                                    ((Bt.lvl.buttonHover[15] /= 4),
                                    (vt.active = !0)),
                                Ft(
                                    "rcorner",
                                    width / 3 + kt,
                                    height / 16 +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 - 2 * kt) +
                                        kt +
                                        ((height - height / 16) / 3 / 3) * 2 +
                                        kt / 2 +
                                        (((height - height / 16) / 3 / 3 -
                                            kt / 2) /
                                            4) *
                                            3 -
                                        kt / 2,
                                    ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                    ((height - height / 16) / 3 / 3 - kt / 2) /
                                        2
                                ))
                            )
                                for (var t in ((Bt.lvl.buttonHover[13] /= 4),
                                Tt.modsDef))
                                    "offset" !== t &&
                                        (Tt.mods[t] = Tt.modsDef[t]);
                            Bt.lvl.modsNSM.click();
                        }
                    else if (!0 === Rt[Bt.lvl.sel]?.local)
                        Bt.lvl.showLeaderboard || Bt.lvl.showMods
                            ? Bt.lvl.showLeaderboard &&
                              Ft(
                                  "rcorner",
                                  width / 3 +
                                      kt +
                                      (((width / 3) * 2 - 2 * kt) / 2 + kt / 2),
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 / 3) * 2 +
                                      kt / 2,
                                  ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                  (height - height / 16) / 3 / 3 - kt / 2
                              ) &&
                              ((Bt.lvl.buttonHover[9] /= 2),
                              (Bt.lvl.showLeaderboard =
                                  !Bt.lvl.showLeaderboard))
                            : (Ft(
                                  "rcorner",
                                  width / 3 + kt,
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt,
                                  ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                  ((height - height / 16) / 3 / 3) * 2 - kt / 2
                              ) &&
                                  ((Tt.edit = !1),
                                  (Tt.replay.on = !1),
                                  // --- EDITED CODE (Stop host from choosing invalid songs)
                                  multiplayer.code == ""
                                      ? qi(Bt.lvl.sel)
                                      : Gn({
                                            type: "error",
                                            message: "multiplayer_playError",
                                        }),
                                  (Bt.lvl.buttonHover[0] /= 2)),
                              Ft(
                                  "rcorner",
                                  width / 3 +
                                      kt +
                                      (((width / 3) * 2 - 4 * kt) / 3) * 0,
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 / 3) * 2 +
                                      kt / 2,
                                  ((width / 3) * 2 - 4 * kt) / 3,
                                  (height - height / 16) / 3 / 3 - kt / 2
                              ) &&
                                  ((Bt.lvl.deleteConfirm = !0),
                                  (Bt.lvl.buttonHover[1] /= 2)),
                              Ft(
                                  "rcorner",
                                  width / 3 +
                                      kt +
                                      (((width / 3) * 2 - 2 * kt) / 2 -
                                          kt / 2) +
                                      kt,
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt,
                                  ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                  ((height - height / 16) / 3 / 3) * 2 - kt / 2
                              ) &&
                                  ((Tt.edit = !0),
                                  (Tt.replay.on = !1),
                                  multiplayer.code == ""
                                      ? qi(Bt.lvl.sel)
                                      : Gn({
                                            type: "error",
                                            message: "multiplayer_editError",
                                        }),
                                  (Bt.lvl.buttonHover[2] /= 2)),
                              !Ft(
                                  "rcorner",
                                  width / 3 +
                                      3 * kt +
                                      (((width / 3) * 2 - 4 * kt) / 3) * 2,
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 / 3) * 2 +
                                      kt / 2,
                                  ((width / 3) * 2 - 4 * kt) / 3,
                                  (height - height / 16) / 3 / 3 - kt / 2
                              ) ||
                                  (void 0 !== Rt[Bt.lvl.sel].copy &&
                                      Rt[Bt.lvl.sel].author !== T.uuid) ||
                                  ((Bt.lvl.uploadConfirm = !0),
                                  (Bt.lvl.buttonHover[3] /= 2)),
                              Ft(
                                  "rcorner",
                                  width / 3 +
                                      2 * kt +
                                      (((width / 3) * 2 - 4 * kt) / 3) * 1,
                                  height / 16 +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 - 2 * kt) +
                                      kt +
                                      ((height - height / 16) / 3 / 3) * 2 +
                                      kt / 2,
                                  ((width / 3) * 2 - 4 * kt) / 3,
                                  (height - height / 16) / 3 / 3 - kt / 2
                              ) &&
                                  ((Bt.lvl.buttonHover[12] /= 2),
                                  (Bt.lvl.showMods = !Bt.lvl.showMods)),
                              Ft(
                                  "ccenter",
                                  width / 3 +
                                      kt +
                                      ((((width / 3) * 2) / 3) * 2 - 2 * kt) +
                                      kt +
                                      ((width / 3) * 2) / 3 -
                                      kt -
                                      1.5 * kt,
                                  height / 16 +
                                      kt +
                                      (height - height / 16) / 3 -
                                      2 * kt -
                                      1.5 * kt,
                                  1.5 * kt,
                                  1.5 * kt
                              ) &&
                                  ((Ht.savedDiffReq[Rt[Bt.lvl.sel].index] =
                                      void 0),
                                  Sn.clear(),
                                  --Bt.lvl.refreshArrowR));
                    else if (Bt.lvl.showLeaderboard || Bt.lvl.showMods)
                        Bt.lvl.showLeaderboard &&
                            ((r = floor(height / 12) - kt),
                            Ft(
                                "rcorner",
                                width / 3 + width / 3 + kt / 2,
                                height - height / 12 + kt / 2,
                                width / 6,
                                r
                            ) &&
                                ((Bt.lvl.buttonHover[9] /= 2),
                                (Bt.lvl.showLeaderboard =
                                    !Bt.lvl.showLeaderboard)),
                            "Loading..." !== Bt.lvl.leaderboardData &&
                                Ft(
                                    "rcorner",
                                    width / 3 + width / 3 - width / 6 - kt / 2,
                                    height - height / 12 + kt / 2,
                                    width / 6,
                                    r
                                ) &&
                                ((Bt.lvl.buttonHover[14] /= 2),
                                v.grabbedScoresLevel.splice(Rt[Bt.lvl.sel], 1),
                                mn.clear()),
                            Ft(
                                "rcorner",
                                width / 3,
                                height - floor(height / 12),
                                width,
                                floor(height / 12)
                            ) || Bt.lvl.newLeaderboard.click());
                    else {
                        if (
                            Ft(
                                "rcorner",
                                width / 3 + kt,
                                height / 16 +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt,
                                (width / 3) * 2 - 2 * kt,
                                ((height - height / 16) / 3 / 3) * 2 - kt / 2
                            )
                        ) {
                            switch (qo(Rt[Bt.lvl.sel])) {
                                case 0:
                                    m(Rt[Bt.lvl.sel], "id", !0);
                                    break;
                                case 1:
                                    break;
                                case 2:
                                    (Tt.edit = !1),
                                        (Tt.replay.on = !1),
                                        // --- EDITED CODE (Stop host from choosing local songs / select correct song)
                                        multiplayer.code == ""
                                            ? qi(Bt.lvl.sel)
                                            : Rt[Bt.lvl.sel]?.local
                                            ? Gn({
                                                  type: "error",
                                                  message:
                                                      "multiplayer_selectError",
                                              })
                                            : ((multiplayer.mapId =
                                                  Rt[Bt.lvl.sel]),
                                              (Bt.trans = "multiplayer"),
                                              Server.setMapData(
                                                  multiplayer.mapId,
                                                  Tt.mods.bpm,
                                                  Tt.mods.hitWindow
                                              ));
                            }
                            Bt.lvl.buttonHover[4] /= 2;
                        }
                        Ft(
                            "rcorner",
                            width / 3 +
                                kt +
                                (((width / 3) * 2 - 4 * kt) / 3) * 0,
                            height / 16 +
                                kt +
                                ((height - height / 16) / 3 - 2 * kt) +
                                kt +
                                ((height - height / 16) / 3 - 2 * kt) +
                                kt +
                                ((height - height / 16) / 3 / 3) * 2 +
                                kt / 2,
                            ((width / 3) * 2 - 4 * kt) / 3,
                            (height - height / 16) / 3 / 3 - kt / 2
                        ) &&
                            (-1 !== Ht.saved.indexOf(Rt[Bt.lvl.sel])
                                ? (Ht.scores.splice(
                                      Ht.saved.indexOf(Rt[Bt.lvl.sel]),
                                      1
                                  ),
                                  Ht.saved.splice(
                                      Ht.saved.indexOf(Rt[Bt.lvl.sel]),
                                      1
                                  ),
                                  0 === Bt.lvl.tab &&
                                      ((Ht.search = []),
                                      (Bt.lvl.sel = !1),
                                      (Bt.lvl.searchSent = !1)))
                                : Ht.saved.push(Rt[Bt.lvl.sel]),
                            (Bt.lvl.buttonHover[5] /= 2)),
                            Ft(
                                "rcorner",
                                width / 3 +
                                    3 * kt +
                                    (((width / 3) * 2 - 4 * kt) / 3) * 2,
                                height / 16 +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    kt / 2,
                                ((width / 3) * 2 - 4 * kt) / 3,
                                (height - height / 16) / 3 / 3 - kt / 2
                            ) &&
                                (!0 === H(Rt[Bt.lvl.sel], "id").ranked
                                    ? (Bt.lvl.showLeaderboard =
                                          !Bt.lvl.showLeaderboard)
                                    : "Loading..." !==
                                          H(Rt[Bt.lvl.sel], "id").author &&
                                      "Metadata" !==
                                          H(Rt[Bt.lvl.sel], "id").beat &&
                                      Mo(Rt[Bt.lvl.sel]),
                                (Bt.lvl.buttonHover[8] /= 2)),
                            Ft(
                                "rcorner",
                                width / 3 +
                                    2 * kt +
                                    (((width / 3) * 2 - 4 * kt) / 3) * 1,
                                height / 16 +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    kt / 2,
                                ((width / 3) * 2 - 4 * kt) / 3,
                                (height - height / 16) / 3 / 3 - kt / 2
                            ) &&
                                ((Bt.lvl.buttonHover[10] /= 2),
                                (Bt.lvl.showMods = !Bt.lvl.showMods)),
                            Ft(
                                "ccenter",
                                width / 3 +
                                    kt +
                                    ((((width / 3) * 2) / 3) * 2 - 2 * kt) +
                                    kt +
                                    ((width / 3) * 2) / 3 -
                                    kt -
                                    1.5 * kt,
                                height / 16 +
                                    kt +
                                    (height - height / 16) / 3 -
                                    2 * kt -
                                    1.5 * kt,
                                1.5 * kt,
                                1.5 * kt
                            ) &&
                                ((v.newGrabbedLevels[Rt[Bt.lvl.sel]] = void 0),
                                (v.newGLRequested[Rt[Bt.lvl.sel]] = void 0),
                                (v.newGLRequestedT[Rt[Bt.lvl.sel]] = void 0),
                                (v.newGLDownloading[Rt[Bt.lvl.sel]] = void 0),
                                Sn.clear(),
                                --Bt.lvl.refreshArrowR);
                    }
                else
                    Ft(
                        "rcorner",
                        (-width / 3) * 2 +
                            kt +
                            (width / 3) * 3 * Bt.lvl.deleteBanner,
                        height / 16 +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 / 3) * 2 +
                            kt / 2,
                        ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                        (height - height / 16) / 3 / 3 - kt / 2
                    ) &&
                        (Bt.lvl.deleteConfirm
                            ? (isNaN(Rt[Bt.lvl.sel].index)
                                  ? Gn({
                                        type: "error",
                                        message: "menu_lvl_deleteError",
                                    })
                                  : (Ht.scores.splice(Rt[Bt.lvl.sel].index, 1),
                                    Ht.localOffsets.splice(
                                        Rt[Bt.lvl.sel].index,
                                        1
                                    ),
                                    Ht.saved.splice(Rt[Bt.lvl.sel].index, 1),
                                    (Ht.search = []),
                                    (Bt.lvl.searchSent = !1),
                                    (Bt.lvl.sel = !1)),
                              (Bt.lvl.deleteConfirm = !1))
                            : Bt.lvl.uploadConfirm &&
                              ((Bt.lvl.uploading = !0),
                              (Bt.lvl.uploadConfirm = !1),
                              void 0 === Rt[Bt.lvl.sel].copy
                                  ? Ho(Bt.lvl.sel)
                                  : Ro(Rt[Bt.lvl.sel])),
                        (Bt.lvl.deleteBanner = 0),
                        (Bt.lvl.buttonHover[6] /= 2)),
                        Ft(
                            "rcorner",
                            (-width / 3) * 2 +
                                (width / 3) * 3 * Bt.lvl.deleteBanner +
                                kt +
                                (((width / 3) * 2 - 2 * kt) / 2 - kt / 2) +
                                kt,
                            height / 16 +
                                kt +
                                ((height - height / 16) / 3 - 2 * kt) +
                                kt +
                                ((height - height / 16) / 3 - 2 * kt) +
                                kt +
                                ((height - height / 16) / 3 / 3) * 2 +
                                kt / 2,
                            ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                            (height - height / 16) / 3 / 3 - kt / 2
                        ) &&
                            ((Bt.lvl.deleteConfirm = !1),
                            (Bt.lvl.uploadConfirm = !1),
                            (Bt.lvl.buttonHover[7] /= 2));
            Bt.lvl.scrollNewLock ||
                (Ft(
                    "rcorner",
                    (height / 24) * 5,
                    height / 16,
                    width / 3 - width / 48 - (height / 24) * 5,
                    height / 24
                ) &&
                    Ri({
                        var: [Bt.lvl, "search"],
                        title: "menu_lvl_search",
                        type: "string",
                        allowEmpty: !0,
                        after: function () {
                            (Ht.search = []),
                                (Bt.lvl.sel = !1),
                                (Bt.lvl.searchSent = !1);
                        },
                    }),
                Ft("rcorner", 0, height / 16, height / 24, height / 24)
                    ? ((Bt.lvl.tab = 0),
                      (Bt.lvl.sortMode = "dateDesc"),
                      (Bt.lvl.showUnranked = !0),
                      (Bt.lvl.search = ""),
                      (Ht.search = []),
                      (Bt.lvl.scroll = 0),
                      (Bt.lvl.sel = !1),
                      (Bt.lvl.searchSent = !1),
                      (Bt.lvl.viewSkip = 0))
                    : Ft(
                          "rcorner",
                          height / 24,
                          height / 16,
                          height / 24,
                          height / 24
                      )
                    ? ((Bt.lvl.tab = 1),
                      (Bt.lvl.sortMode = "starsAsc"),
                      (Bt.lvl.showUnranked = !1),
                      (Bt.lvl.search = ""),
                      (Ht.search = []),
                      (Bt.lvl.scroll = 0),
                      (Bt.lvl.sel = !1),
                      (Bt.lvl.searchSent = !1),
                      (Bt.lvl.viewSkip = 0))
                    : Ft(
                          "rcorner",
                          width / 3 - width / 48,
                          height / 16,
                          width / 48,
                          height / 24
                      )
                    ? Ji()
                    : Ft(
                          "rcorner",
                          (height / 24) * 2,
                          height / 16,
                          height / 24,
                          height / 24
                      )
                    ? ((Bt.lvl.showUnranked = !Bt.lvl.showUnranked),
                      (Ht.search = []),
                      (Bt.lvl.sel = !1),
                      (Bt.lvl.tabHighlight[7] /= 2),
                      (Bt.lvl.searchSent = !1),
                      (Bt.lvl.viewSkip = 0))
                    : Ft(
                          "rcorner",
                          (height / 24) * 4,
                          height / 16,
                          height / 24,
                          height / 24
                      )
                    ? ((Bt.lvl.searchMode =
                          Bt.lvl.searchModes.indexOf(Bt.lvl.searchMode) + 1),
                      Bt.lvl.searchMode > Bt.lvl.searchModes.length - 1 &&
                          (Bt.lvl.searchMode = 0),
                      (Bt.lvl.searchMode =
                          Bt.lvl.searchModes[Bt.lvl.searchMode]),
                      (Bt.lvl.tabHighlight[2] /= 2),
                      (Bt.lvl.searchSent = !1),
                      (Bt.lvl.viewSkip = 0))
                    : Ft(
                          "rcorner",
                          (height / 24) * 3,
                          height / 16,
                          height / 24,
                          height / 24
                      ) &&
                      ((Bt.lvl.sortMode =
                          Bt.lvl.sortModes.indexOf(Bt.lvl.sortMode) + 1),
                      Bt.lvl.sortMode > Bt.lvl.sortModes.length - 1 &&
                          (Bt.lvl.sortMode = 0),
                      (Ht.search = []),
                      (Bt.lvl.sortMode = Bt.lvl.sortModes[Bt.lvl.sortMode]),
                      (Bt.lvl.tabHighlight[4] /= 2),
                      (Bt.lvl.searchSent = !1),
                      (Bt.lvl.viewSkip = 0)));
        } else if ("song" === Bt.screen)
            if ("song" === Bt.song.mode) {
                (Rt = []), (Rt = Uo(O.search, Bt.song.sortMode));
                for (var i, e = 0; e < Rt.length; e++)
                    (i =
                        height / 16 +
                        height / 24 +
                        (height / 12) * e -
                        (Rt.length >
                        (height - (height / 16 + height / 24)) / (height / 12)
                            ? (Bt.lvl.scroll /
                                  (height -
                                      (height / 16 + height / 24) -
                                      (height - (height / 16 + height / 24)) /
                                          12)) *
                              ((height / 12) *
                                  (Rt.length -
                                      (height - (height / 16 + height / 24)) /
                                          (height / 12)))
                            : 0)) < height &&
                        0 < i &&
                        (width > height ? width : height,
                        Ft(
                            "rcorner",
                            0,
                            i,
                            width / 3 - width / 48,
                            height / 12
                        )) &&
                        (!0 === Bt.song.listening &&
                            ((Bt.song.listening = !1),
                            soundManager.pause(Rt[Bt.song.sel]),
                            soundManager.setVolume(
                                "menuMusic",
                                Bt.settings.musicVolume
                            )),
                        (Bt.song.sel = e));
                !1 !== Bt.song.sel &&
                    (Ft(
                        "rcorner",
                        width / 3 + kt,
                        height / 16 +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt,
                        (width / 3) * 2 - 2 * kt,
                        ((height - height / 16) / 3 / 3) * 2 - kt / 2
                    ) &&
                        (So(String(Rt[Bt.song.sel])),
                        (Bt.song.buttonHover[4] /= 2)),
                    Ft(
                        "rcorner",
                        width / 3 + kt,
                        height / 16 +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 / 3) * 2 +
                            kt / 2,
                        (width / 3) * 2 - 2 * kt,
                        (height - height / 16) / 3 / 3 - kt / 2
                    ) &&
                        (-1 !== O.saved.indexOf(Rt[Bt.song.sel])
                            ? (O.saved.splice(
                                  O.saved.indexOf(Rt[Bt.song.sel]),
                                  1
                              ),
                              0 === Bt.song.tab &&
                                  ((O.search = []), (Bt.song.sel = !1)))
                            : O.saved.push(Rt[Bt.song.sel]),
                        (Bt.song.buttonHover[5] /= 2)),
                    Ft(
                        "rcorner",
                        width / 3 + kt + kt,
                        height / 16 +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) +
                            kt +
                            ((height - height / 16) / 3 - 2 * kt) / 2 -
                            kt,
                        2 * kt,
                        2 * kt
                    )) &&
                    (!1 === Bt.song.listening
                        ? ((Bt.song.listening = !0),
                          ao(Rt[Bt.song.sel]),
                          soundManager.load(Rt[Bt.song.sel]),
                          soundManager.setVolume(
                              Rt[Bt.song.sel],
                              Bt.settings.musicVolume
                          ),
                          soundManager.setVolume("menuMusic", 0))
                        : ((Bt.song.listening = !1),
                          soundManager.pause(Rt[Bt.song.sel]),
                          soundManager.setVolume(
                              "menuMusic",
                              Bt.settings.musicVolume
                          ))),
                    Ft("rcorner", 0, height / 16, height / 24, height / 24)
                        ? (Bt.song.listening &&
                              ((Rt = []),
                              (Rt = O.search),
                              (Bt.song.listening = !1),
                              soundManager.pause(Rt[Bt.song.sel]),
                              soundManager.setVolume(
                                  "menuMusic",
                                  Bt.settings.musicVolume
                              )),
                          (Bt.song.tab = 0),
                          (Bt.song.search = ""),
                          (O.search = []),
                          (Bt.lvl.scroll = 0),
                          (Bt.song.sel = !1))
                        : Ft(
                              "rcorner",
                              height / 24,
                              height / 16,
                              height / 24,
                              height / 24
                          )
                        ? (Bt.song.listening &&
                              ((Rt = []),
                              (Rt = O.search),
                              (Bt.song.listening = !1),
                              soundManager.pause(Rt[Bt.song.sel]),
                              soundManager.setVolume(
                                  "menuMusic",
                                  Bt.settings.musicVolume
                              )),
                          (Bt.song.tab = 1),
                          (Bt.song.search = ""),
                          (O.search = []),
                          (Bt.lvl.scroll = 0),
                          (Bt.song.sel = !1))
                        : Ft(
                              "rcorner",
                              width / 3 - width / 48,
                              height / 16,
                              width / 48,
                              height / 24
                          ) && !Bt.lvl.scrollNewLock
                        ? void 0 !== T.uuid &&
                          null !== T.uuid &&
                          0 !== T.uuid.length &&
                          ((Bt.song.listening = !1),
                          soundManager.pause(Rt[Bt.song.sel]),
                          soundManager.setVolume(
                              "menuMusic",
                              Bt.settings.menuMusicVolume
                          ),
                          (Bt.song.mode = "newSong"),
                          (Bt.song.overlayOn = !0))
                        : Ft(
                              "rcorner",
                              (height / 24) * 3,
                              height / 16,
                              height / 24,
                              height / 24
                          )
                        ? ((Bt.song.searchMode =
                              Bt.song.searchModes.indexOf(Bt.song.searchMode) +
                              1),
                          Bt.song.searchMode > Bt.song.searchModes.length - 1 &&
                              (Bt.song.searchMode = 0),
                          (Bt.song.searchMode =
                              Bt.song.searchModes[Bt.song.searchMode]),
                          (Bt.song.tabHighlight[2] /= 2))
                        : Ft(
                              "rcorner",
                              (height / 24) * 2,
                              height / 16,
                              height / 24,
                              height / 24
                          ) &&
                          ((Bt.song.sortMode =
                              Bt.song.sortModes.indexOf(Bt.song.sortMode) + 1),
                          Bt.song.sortMode > Bt.song.sortModes.length - 1 &&
                              (Bt.song.sortMode = 0),
                          (Bt.song.sortMode =
                              Bt.song.sortModes[Bt.song.sortMode]),
                          (Bt.song.tabHighlight[4] /= 2)),
                    Ft(
                        "rcorner",
                        (height / 24) * 4,
                        height / 16,
                        width / 3 - width / 48 - (height / 24) * 4,
                        height / 24
                    ) &&
                        Ri({
                            var: [Bt.song, "search"],
                            title: "menu_lvl_search",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (O.search = []), (Bt.song.sel = !1);
                            },
                        });
            } else
                "newSong" === Bt.song.mode
                    ? (Ft(
                          "rcorner",
                          3 * kt,
                          height / 16 +
                              (height / 32) * 3 +
                              7 * kt +
                              (height / 16) * 8,
                          width / 8,
                          height / 16
                      )
                          ? ((Bt.song.mode = "song"),
                            (Bt.song.overlayOn = !1),
                            (Bt.newSong.title = ""),
                            (Bt.newSong.artist = ""),
                            (Bt.newSong.link = ""),
                            (Bt.song.errors = []),
                            (Bt.song.blankErrors = []),
                            (Bt.song.takenErrors = []),
                            (Bt.song.buttonHover[4] /= 2))
                          : Ft(
                                "rcorner",
                                4 * kt + width / 8,
                                height / 16 +
                                    (height / 32) * 3 +
                                    7 * kt +
                                    (height / 16) * 8,
                                width / 8,
                                height / 16
                            ) && (gn(), (Bt.account.buttonHover[3] /= 2)),
                      Ft(
                          "rcorner",
                          3 * kt,
                          height / 16 +
                              (height / 32) * 3 +
                              3 * kt +
                              height / 16,
                          width / 2,
                          height / 16
                      )
                          ? Ri({
                                var: [Bt.newSong, "title"],
                                title: "menu_newSong_songTitle",
                                type: "string",
                                allowEmpty: !0,
                            })
                          : Ft(
                                "rcorner",
                                3 * kt,
                                height / 16 +
                                    (height / 32) * 3 +
                                    4 * kt +
                                    (height / 16) * 3,
                                width / 2,
                                height / 16
                            )
                          ? Ri({
                                var: [Bt.newSong, "artist"],
                                title: "menu_newSong_songArtist",
                                type: "string",
                                allowEmpty: !0,
                            })
                          : Ft(
                                "rcorner",
                                3 * kt,
                                height / 16 +
                                    (height / 32) * 3 +
                                    5 * kt +
                                    (height / 16) * 5,
                                width / 2,
                                height / 16
                            ) &&
                            ((re.type = "audio"),
                            (re.sizeLimit = Bt.newSong.sizeLimit),
                            (re.success = (e) => {
                                e = e.file;
                                const t = new FileReader();
                                t.addEventListener(
                                    "load",
                                    () => {
                                        var e = t.result;
                                        Bt.newSong.link = e;
                                    },
                                    !1
                                ),
                                    t.readAsDataURL(e);
                            }),
                            settingsFileInput.elt.click()))
                    : "verify" === Bt.song.mode
                    ? 2 === Bt.newSong.songObject.readyState ||
                      !0 === Bt.newSong.failedLinksCheck
                        ? Ft(
                              "rcorner",
                              width / 2 - width / 4 / 2,
                              ((height - height / 16) / 4) * 3,
                              width / 4,
                              height / 8
                          ) &&
                          ((Bt.song.mode = "newSong"),
                          (Bt.newSong.songLoading = !1),
                          (Bt.newSong.songPlaying = !1),
                          (Bt.newSong.failedLinks[
                              Bt.newSong.failedLinks.length
                          ] = Bt.newSong.link),
                          (Bt.newSong.failedLinksCheck = !1),
                          (Bt.song.buttonHover[7] /= 2))
                        : 3 === Bt.newSong.songObject.readyState &&
                          (Ft(
                              "rcorner",
                              (width / 16) * 11 - width / 4 / 2,
                              ((height - height / 16) / 4) * 3,
                              width / 4,
                              height / 8
                          ) &&
                              ((Bt.song.mode = "newSong"),
                              (Bt.newSong.songLoading = !1),
                              (Bt.newSong.songPlaying = !1),
                              (Bt.newSong.verifyDim = 0),
                              (Bt.newSong.failedLinksCheck = !1),
                              (Bt.song.buttonHover[8] /= 2),
                              soundManager.stop(Bt.newSong.link + "verify"),
                              to()),
                          Ft(
                              "rcorner",
                              (width / 16) * 5 - width / 4 / 2,
                              ((height - height / 16) / 4) * 3,
                              width / 4,
                              height / 8
                          )) &&
                          ((Bt.song.mode = "upload"),
                          (Bt.song.buttonHover[7] /= 2),
                          soundManager.stop(Bt.newSong.link + "verify"),
                          to(),
                          B("uploadSong", {
                              name: Bt.newSong.title,
                              artist: Bt.newSong.artist,
                              link: Bt.newSong.link,
                              uploader: T.uuid,
                              session: T.session,
                          }))
                    : "upload" === Bt.song.mode &&
                      Ft(
                          "rcorner",
                          width / 2 - width / 4 / 2,
                          ((height - height / 16) / 4) * 3,
                          width / 4,
                          height / 8
                      ) &&
                      ((Bt.song.mode = "song"),
                      (Bt.song.overlayOn = !1),
                      (Bt.newSong.songLoading = !1),
                      (Bt.newSong.songPlaying = !1),
                      (Bt.newSong.failedLinks[Bt.newSong.failedLinks.length] =
                          Bt.newSong.link),
                      (Bt.newSong.failedLinksCheck = !1),
                      (Bt.newSong.title = ""),
                      (Bt.newSong.artist = ""),
                      (Bt.newSong.link = ""),
                      (Bt.song.buttonHover[7] /= 2));
        else if ("online" === Bt.screen) {
            if ("main" === Bt.online.mode) {
                for (e = 0; e < Bt.online.searchedUsers.length; e++)
                    Ft(
                        "rcorner",
                        kt + ((width - width / 48 - 4 * kt) / 3 + kt) * (e % 3),
                        kt +
                            height / 16 +
                            height / 24 +
                            5 * kt * floor(e / 3) +
                            (-(
                                kt +
                                height / 16 +
                                height / 24 +
                                5 *
                                    kt *
                                    floor(
                                        (Bt.online.searchedUsers.length - 1) / 3
                                    )
                            ) +
                                height -
                                5 * kt <
                            0
                                ? Bt.online.scroll
                                : 0),
                        (width - width / 48 - 4 * kt) / 3,
                        4 * kt
                    ) &&
                        mouseY > height / 16 + height / 24 &&
                        ((Bt.online.viewUser = Bt.online.searchedUsers[e]),
                        (Bt.online.mode = "viewUser"),
                        (Bt.online.viewUserUUIDCheck = !1),
                        bo(Bt.online.viewUser));
                Ft(
                    "rcorner",
                    height / 24,
                    height / 16,
                    width - height / 24,
                    height / 24
                ) &&
                    Ri({
                        var: [Bt.online, "search"],
                        title: "menu_lvl_search",
                        type: "string",
                        allowEmpty: !0,
                        after: function () {
                            Bt.online.searchedUsers = [];
                        },
                    }),
                    Ft("rcorner", 0, height / 16, height / 24, height / 24) &&
                        ((Bt.online.searchOnline = !Bt.online.searchOnline),
                        (Bt.online.tabHighlight[0] /= 2),
                        (Bt.online.searchedUsers = []),
                        (v.newGrabbedUser = []),
                        (v.newGrabbedUserUsername = []),
                        (v.newGUUnix = []),
                        (v.newGURequested = []),
                        (v.newGURequestedT = []));
            } else if ("viewUser" === Bt.online.mode) $n("online");
            else if ("newSong" === Bt.online.mode)
                !1 === Bt.newSong.verify
                    ? Ft(
                          "rcorner",
                          width / 32 / 2,
                          ((height - (height / 16 + (height / 32) * 3)) / 16) *
                              11 +
                              (height / 16 + (height / 32) * 3),
                          ((width / 4) * 3 - width / 32) / 3,
                          (height - (height / 16 + (height / 32) * 3)) / 8,
                          height / 64
                      )
                        ? (Bt.online.mode = "song")
                        : Ft(
                              "rcorner",
                              width / 4 + width / 32 / 2,
                              ((height - (height / 16 + (height / 32) * 3)) /
                                  16) *
                                  2 +
                                  (height / 16 + (height / 32) * 3),
                              (width / 4) * 3 - width / 32,
                              (height - (height / 16 + (height / 32) * 3)) / 8
                          )
                        ? Ri({
                              var: [Bt.newSong, "title"],
                              title: "menu_newSong_songTitle",
                              type: "string",
                              allowEmpty: !1,
                          })
                        : Ft(
                              "rcorner",
                              width / 4 + width / 32 / 2,
                              ((height - (height / 16 + (height / 32) * 3)) /
                                  16) *
                                  5 +
                                  (height / 16 + (height / 32) * 3),
                              (width / 4) * 3 - width / 32,
                              (height - (height / 16 + (height / 32) * 3)) / 8
                          )
                        ? Ri({
                              var: [Bt.newSong, "artist"],
                              title: "menu_newSong_songArtist",
                              type: "string",
                              allowEmpty: !1,
                          })
                        : Ft(
                              "rcorner",
                              width / 4 + width / 32 / 2,
                              ((height - (height / 16 + (height / 32) * 3)) /
                                  16) *
                                  8 +
                                  (height / 16 + (height / 32) * 3),
                              (width / 4) * 3 - width / 32,
                              (height - (height / 16 + (height / 32) * 3)) / 8
                          ) ||
                          (Ft(
                              "rcorner",
                              width / 4 + width / 32 / 2,
                              ((height - (height / 16 + (height / 32) * 3)) /
                                  16) *
                                  11 +
                                  (height / 16 + (height / 32) * 3),
                              ((width / 4) * 3 - width / 32) / 3,
                              (height - (height / 16 + (height / 32) * 3)) / 8
                          ) &&
                              (0 !== Bt.newSong.title.length &&
                              0 !== Bt.newSong.artist.length &&
                              0 !== Bt.newSong.link.length
                                  ? (Bt.newSong.verify = !0)
                                  : (Bt.newSong.verifyError = !0)))
                    : !0 === Bt.newSong.verify
                    ? 2 === Bt.newSong.songObject.readyState ||
                      !0 === Bt.newSong.failedLinksCheck
                        ? Ft(
                              "rcorner",
                              width / 32 / 2,
                              ((height - (height / 16 + (height / 32) * 3)) /
                                  16) *
                                  11 +
                                  (height / 16 + (height / 32) * 3),
                              ((width / 4) * 3 - width / 32) / 3,
                              (height - (height / 16 + (height / 32) * 3)) / 8,
                              height / 64
                          ) &&
                          ((Bt.newSong.verify = !1),
                          (Bt.newSong.songLoading = !1),
                          (Bt.newSong.songPlaying = !1),
                          (Bt.newSong.verifyDim = 0),
                          (Bt.newSong.failedLinks[
                              Bt.newSong.failedLinks.length
                          ] = Bt.newSong.link),
                          (Bt.newSong.failedLinksCheck = !1))
                        : 3 === Bt.newSong.songObject.readyState &&
                          (Ft(
                              "rcenter",
                              (width / 16) * 11,
                              ((height - height / 16) / 4) * 3,
                              width / 4,
                              height / 8,
                              height / 64
                          ) &&
                              ((Bt.newSong.verify = !1),
                              (Bt.newSong.songLoading = !1),
                              (Bt.newSong.songPlaying = !1),
                              (Bt.newSong.verifyDim = 0),
                              (Bt.newSong.failedLinksCheck = !1),
                              soundManager.stop(Bt.newSong.link + "verify")),
                          Ft(
                              "rcenter",
                              (width / 16) * 5,
                              ((height - height / 16) / 4) * 3,
                              width / 4,
                              height / 8,
                              height / 64
                          )) &&
                          ((Bt.newSong.verify = "upload"),
                          soundManager.stop(Bt.newSong.link + "verify"),
                          B("uploadSong", {
                              name: Bt.newSong.title,
                              artist: Bt.newSong.artist,
                              link: Bt.newSong.link,
                              uploader: T.uuid,
                              session: T.session,
                          }))
                    : "upload" === Bt.newSong.verify &&
                      Ft(
                          "rcorner",
                          width / 32 / 2,
                          ((height - (height / 16 + (height / 32) * 3)) / 16) *
                              11 +
                              (height / 16 + (height / 32) * 3),
                          ((width / 4) * 3 - width / 32) / 3,
                          (height - (height / 16 + (height / 32) * 3)) / 8,
                          height / 64
                      ) &&
                      ((Bt.newSong.verify = !1),
                      (Bt.newSong.songLoading = !1),
                      (Bt.newSong.songPlaying = !1),
                      (Bt.newSong.verifyDim = 0),
                      (Bt.newSong.failedLinks[Bt.newSong.failedLinks.length] =
                          Bt.newSong.link),
                      (Bt.newSong.failedLinksCheck = !1),
                      (Bt.newSong.uploaded = !1),
                      (Bt.newSong.uploadID = 0));
            else if ("levels" === Bt.online.mode) {
                if (mouseY > (height - height / 16) / 4 + height / 16)
                    for (e = 0; e < Bt.onlineLvl.data.length; e++)
                        Ft(
                            "rcorner",
                            0,
                            (height - height / 16) / 4 +
                                height / 16 +
                                ((((height - height / 16) / 4) * 3) / 8) * e +
                                ((((height - height / 16) / 4) * 3) / 8) *
                                    (-Bt.onlineLvl.scroll *
                                        Bt.onlineLvl.scrollSize),
                            width - width / 32,
                            (((height - height / 16) / 4) * 3) / 8
                        ) && (Bt.onlineLvl.sel = e);
                Ft(
                    "rcenter",
                    ((width / 12) * 5) / 4 / 2 +
                        ((width / 12) * 5 - ((width / 12) * 5) / 4) / 4 / 2,
                    ((height - height / 16) / 4 / 3) * 1 + height / 16,
                    ((width / 12) * 5 - ((width / 12) * 5) / 4) / 4,
                    (height - height / 16) / 4 / 2 / 2
                ) && (Bt.online.mode = "main"),
                    Ft(
                        "rcenter",
                        (width / 12) * 5 + width / 4 + (width / 3 / 8) * 4,
                        height / 16 + ((height - height / 16) / 4 / 6) * 2,
                        width / 3 -
                            2 *
                                ((width / 12) * 5 +
                                    width / 4 +
                                    (width / 3 / 8) * 2.0625 -
                                    ((width / 3 / 8) * 3.5) / 2 -
                                    ((width / 12) * 5 + width / 4)),
                        ((height - height / 16) / 4 / 6) * 3
                    ) && _i(Bt.onlineLvl.data[Bt.onlineLvl.sel].id);
            }
        } else if ("settings" === Bt.screen) Bt.settings.menu.click();
        else if ("socialMedia" === Bt.screen)
            Ft(
                "rcorner",
                width / 2 - width / 4 / 2,
                height / 2,
                width / 4,
                height / 8
            ) && ((Bt.socialMedia.buttonHover[0] /= 2), p());
        else if ("patreon" === Bt.screen)
            Ut(T.uuid, "uuid").patreon > w ||
                (Ft(
                    "rcorner",
                    width / 2 - width / 4 / 2,
                    height / 2 + height / 8,
                    width / 4,
                    height / 8
                ) &&
                    ((Bt.socialMedia.buttonHover[0] /= 2), b()));
        else if ("morePulsus" === Bt.screen) {
            var o = width / 16 / 2 / 2,
                n = (height / 16) * 1.5;
            let e = 0;
            for (const f of [
                "https://patreon.com/tetrogem",
                "https://discord.pulsus.cc",
                "https://wiki.pulsus.cc",
                "https://contribute.pulsus.cc",
            ]) {
                var s = (height / 8) * 1.5 * e + height / 8;
                Ft(
                    "rcorner",
                    width - width / 4 - width / 16 + o,
                    -height / 8 / 2 + n + s,
                    width / 4,
                    height / 8
                ) &&
                    (console.log("Open " + e),
                    open(f),
                    (Bt.socialMedia.buttonHover[e] /= 2)),
                    e++;
            }
            // --- EDITED CODE (Clickable objects in multiplayer screen)
        } else if ("multiplayer" === Bt.screen) {
            var i = width > height ? width / 64 : height / 64;
            if (multiplayer.code == "") {
                Ft(
                    "rcorner",
                    (width * 5) / 8,
                    (height * 4) / 16,
                    width / 3,
                    height / 16
                ) &&
                    Ri({
                        var: [multiplayer, "code"],
                        title: "menu_lvl_search",
                        type: "string",
                        allowEmpty: !0,
                        after: function () {
                            if (multiplayer.code == "") {
                                multiplayer.roomUsers = {};
                                Server.logOff();
                            } else {
                                Server.setLobby(multiplayer.code);
                            }
                        },
                    });
            } else {
                if (Bt.lvl.showMods)
                    if (vt.active) vt.callback?.();
                    else {
                        if (
                            (Ft(
                                "rcorner",
                                width / 3 +
                                    kt +
                                    (((width / 3) * 2 - 2 * kt) / 2 + kt / 2),
                                height / 16 +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    kt / 2 +
                                    (((height - height / 16) / 3 / 3 - kt / 2) /
                                        4) *
                                        3 -
                                    kt / 2,
                                ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                ((height - height / 16) / 3 / 3 - kt / 2) / 2
                            ) &&
                                ((Bt.lvl.buttonHover[11] /= 4),
                                (Bt.lvl.showMods = !Bt.lvl.showMods),
                                multiplayer.isHost
                                    ? Server.setMapData(
                                          multiplayer.mapId,
                                          Tt.mods.bpm,
                                          Tt.mods.hitWindow
                                      )
                                    : void 0),
                            // Ft("rcorner", width / 3 + kt + ((width / 3 * 2 - 2 * kt) / 2 + kt / 2), height / 16 + kt + ((height - height / 16) / 3 - 2 * kt) + kt + ((height - height / 16) / 3 - 2 * kt) + kt + (height - height / 16) / 3 / 3 * 2 + kt / 2 + ((height - height / 16) / 3 / 3 - kt / 2) / 4 * 3 - kt / 2 - ((height - height / 16) / 3 / 3 - kt / 2) / 2 - kt / 2, (width / 3 * 2 - 2 * kt) / 2 - kt / 2, ((height - height / 16) / 3 / 3 - kt / 2) / 2) && (Bt.lvl.buttonHover[15] /= 4,
                            // vt.active = !0),
                            Ft(
                                "rcorner",
                                width / 3 + kt,
                                height / 16 +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 - 2 * kt) +
                                    kt +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    kt / 2 +
                                    (((height - height / 16) / 3 / 3 - kt / 2) /
                                        4) *
                                        3 -
                                    kt / 2,
                                ((width / 3) * 2 - 2 * kt) / 2 - kt / 2,
                                ((height - height / 16) / 3 / 3 - kt / 2) / 2
                            ))
                        )
                            for (var t in ((Bt.lvl.buttonHover[13] /= 4),
                            Tt.modsDef))
                                "offset" !== t && (Tt.mods[t] = Tt.modsDef[t]);
                        multiplayer.isHost
                            ? multiplayer.modsNSM.host.click()
                            : multiplayer.modsNSM.player.click();
                    }
                else {
                    multiplayer.isHost
                        ? //host spectator button
                          (Ft(
                              "rcorner",
                              width / 3 + i,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2,
                              ((width / 3) * 2 - 4 * i) / 3,
                              (height - height / 16) / 3 / 3 - i / 2
                          ) &&
                              ((Bt.lvl.buttonHover[11] /= 4),
                              console.log("Spectating activation here.")),
                          //host mods button
                          Ft(
                              "rcorner",
                              width / 3 + 2 * i + ((width / 3) * 2 - 4 * i) / 3,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2,
                              ((width / 3) * 2 - 4 * i) / 3,
                              (height - height / 16) / 3 / 3 - i / 2
                          ) &&
                              (console.log("hi"),
                              (Bt.lvl.buttonHover[12] /= 4),
                              (Bt.lvl.showMods = true)),
                          Ft(
                              "rcorner",
                              width / 3 +
                                  3 * i +
                                  (((width / 3) * 2 - 4 * i) / 3) * 2,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2,
                              ((width / 3) * 2 - 4 * i) / 3,
                              (height - height / 16) / 3 / 3 - i / 2
                          ) &&
                              ((Bt.lvl.buttonHover[3] /= 4),
                              (Bt.trans = "lvl")))
                        : (Ft(
                              "rcorner",
                              width / 3 + i,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2,
                              ((width / 3) * 2 - 4 * i) / 2,
                              (height - height / 16) / 3 / 3 - i / 2,
                              (height - height / 16) / 3 / 3 - i / 2
                          ) &&
                              ((Bt.lvl.buttonHover[11] /= 4),
                              console.log("Spectating activation here.")),
                          Ft(
                              "rcorner",
                              width / 3 + 3 * i + ((width / 3) * 2 - 4 * i) / 2,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 / 3) * 2 +
                                  i / 2,
                              ((width / 3) * 2 - 4 * i) / 2,
                              (height - height / 16) / 3 / 3 - i / 2
                          ) &&
                              (console.log("hi"),
                              (Bt.lvl.buttonHover[3] /= 4),
                              (Bt.lvl.showMods = !Bt.lvl.showMods)));

                    //download/ready/unready/play button?????
                    if (
                        Ft(
                            "rcorner",
                            width / 3 + i,
                            height / 16 +
                                i +
                                ((height - height / 16) / 3 - 2 * i) +
                                i +
                                ((height - height / 16) / 3 - 2 * i) +
                                i,
                            (width / 3) * 2 - 2 * i,
                            ((height - height / 16) / 3 / 3) * 2 - i / 2
                        )
                    ) {
                        switch (qo(multiplayer.mapId)) {
                            case 0: //the map hasn't been downloaded yet
                                m(multiplayer.mapId, "id", !0);
                                break;
                            case 1: //uhhhhhhhhhh map is currently downloading maybe idk?
                                break;
                            case 2:
                                Tt.edit = false;
                                Tt.replay.on = false;

                                //EDIT HEEEYYY HIIII HELLOO ITS MEEEE
                                //T9 here, it looks like there just straight up wasn't logic here to check if everyone else was ready??
                                //but i cant really read this stuff like you can so lmk if im being stupid because im probably being very stupid
                                //i kinda restructured this whole part
                                //for now, I just have the host ready themselves on match start like everyone else for consistency

                                //If the host is starting the match they better be fucking ready
                                if (multiplayer.isHost) {
                                    setReady(true);
                                } else {
                                    setReady(!multiplayer.ready);
                                }

                                if (multiplayer.isHost) {
                                    //when the host clicks the start button, check to see if all players are ready before actually starting the match
                                    //i cant really test this logic on my own soooooo
                                    let allPlayersReady = true;
                                    for (const user of Object.values(
                                        multiplayer.roomUsers
                                    )) {
                                        if (!user.ready) {
                                            allPlayersReady = false;
                                            break;
                                        }
                                    }

                                    if (allPlayersReady) {
                                        Server.setStartTime();
                                    } else {
                                        console.log(
                                            "You can't start the map yet! Some players aren't ready"
                                        );
                                    }
                                }
                        }
                        Bt.lvl.buttonHover[4] /= 2;
                    }
                }
            }
        }
    if ("game" === He) {
        if (1 === Tt.disMode)
            if (!0 === Tt.edit) {
                var r,
                    h,
                    a = Tt.timelineBPM / Tt.bpm;
                if (!1 === Tt.menu)
                    if (Ft("rcorner", 0, 0, kt, kt)) Nn();
                    else {
                        if (0 === Tt.editorMode) {
                            for (e = 0; e < 9; e++)
                                if (
                                    Ft(
                                        "rcenter",
                                        ((Tt.board.w * Tt.board.c * 3) / 8) *
                                            ((e % 3) - 1) +
                                            width / 2,
                                        ((Tt.board.h * Tt.board.c * 3) / 8) *
                                            (floor(e / 3) - 1) +
                                            height / 2,
                                        (Tt.board.w * Tt.board.c) / 4 +
                                            Tt.board.str *
                                                (Tt.board.c / 64) *
                                                Tt.missTiles[e][0],
                                        (Tt.board.h * Tt.board.c) / 4 +
                                            Tt.board.str *
                                                (Tt.board.c / 64) *
                                                Tt.missTiles[e][0]
                                    )
                                ) {
                                    for (
                                        var l = !1, d = 0;
                                        d < Tt.beat.length;
                                        d++
                                    )
                                        Ot(1e6 * Tt.beat[d][1]) / 1e6 ==
                                            Ot(
                                                1e6 *
                                                    (Ot(
                                                        (Tt.time -
                                                            (Tt.bpm /
                                                                60 /
                                                                1e3) *
                                                                Tt.timelineOffset) *
                                                            (1 / Tt.snap) *
                                                            a
                                                    ) /
                                                        ((1 / Tt.snap) * a) +
                                                        (Tt.bpm / 60 / 1e3) *
                                                            Tt.timelineOffset)
                                            ) /
                                                1e6 &&
                                            Tt.beat[d][0] === e &&
                                            (l = d);
                                    "scroll" === Tt.timelineMode
                                        ? !1 === l
                                            ? ((Tt.beat[Tt.beat.length] = []),
                                              (Tt.beat[Tt.beat.length - 1] = [
                                                  e,
                                                  Ot(
                                                      (Tt.time -
                                                          (Tt.bpm / 60 / 1e3) *
                                                              Tt.timelineOffset) *
                                                          (1 / Tt.snap) *
                                                          a
                                                  ) /
                                                      ((1 / Tt.snap) * a) +
                                                      (Tt.bpm / 60 / 1e3) *
                                                          Tt.timelineOffset,
                                                  !1,
                                                  0,
                                                  !1,
                                                  Tt.objType,
                                                  Tt.holdLength / a,
                                                  0,
                                                  0,
                                                  Tt.timelineBPM,
                                                  Tt.timelineOffset,
                                                  Tt.beatColor,
                                                  null,
                                                  Tt.transitionIn,
                                                  Tt.transitionOut,
                                                  !1,
                                                  Tt.beatSaturation,
                                                  Tt.beatBrightness,
                                              ]))
                                            : Tt.beat.splice(l, 1)
                                        : "select" === Tt.timelineMode &&
                                          !1 !== l &&
                                          jn(l, "beat");
                                }
                            if ("select" === Tt.timelineMode) {
                                for (e = 0; e < Tt.beat.length; e++)
                                    Ft(
                                        "rcenter",
                                        (width / 32) *
                                            (Tt.beat[e][1] * a) *
                                            (1 / Tt.snap) -
                                            floor(width / 36) / 3 +
                                            Ot(floor(width / 36) / 3) *
                                                floor(Tt.beat[e][0] % 3) +
                                            (width / 2 -
                                                (width / 32) *
                                                    ((Tt.time * a) / Tt.snap)),
                                        (height / 16) * Tt.headerY +
                                            height / 16 -
                                            height / 16 / 2 -
                                            floor(width / 36) / 3 +
                                            Ot(floor(width / 36) / 3) *
                                                floor(Tt.beat[e][0] / 3),
                                        floor(width / 48) / 3,
                                        floor(width / 48) / 3
                                    ) && jn(e, "beat");
                                0 < Tt.selectedBeats.length &&
                                    Tt.beatNSM.click();
                            }
                        } else if (1 === Tt.editorMode)
                            if (
                                Ft(
                                    "rcorner",
                                    width - width / 4,
                                    (height / 16) * 2,
                                    width / 2,
                                    (height / 16) * 14
                                )
                            )
                                Tt.effectsNSM.click();
                            else if ("select" === Tt.timelineMode)
                                for (e = 0; e < Tt.effects.length; e++)
                                    if (
                                        Ft(
                                            "rcenter",
                                            (width / 32) *
                                                (Tt.effects[e].time * a) *
                                                (1 / Tt.snap) +
                                                ((width / 32) *
                                                    (1 / Tt.snap) *
                                                    (Tt.effects[e].moveTime *
                                                        a)) /
                                                    2 +
                                                (width / 2 -
                                                    (width / 32) *
                                                        ((Tt.time * a) /
                                                            Tt.snap)),
                                            (height / 16) * Tt.headerY +
                                                height / 16 -
                                                height / 16 / 2 +
                                                (height / 24) *
                                                    Tt.effects[e].track,
                                            width / 64 +
                                                (width / 32) *
                                                    (1 / Tt.snap) *
                                                    (Tt.effects[e].moveTime *
                                                        a),
                                            width / 64,
                                            width
                                        )
                                    ) {
                                        jn(e, "effects");
                                        break;
                                    }
                        if ("select" === Tt.timelineMode) {
                            for (
                                var g = Fn(), e = 0;
                                e < Tt.sections.length;
                                e++
                            )
                                if (
                                    Ft(
                                        "ccenter",
                                        (width / 32) *
                                            (Tt.sections[e].time * a) *
                                            (1 / Tt.snap) +
                                            (width / 2 -
                                                (width / 32) *
                                                    ((Tt.time * a) / Tt.snap)),
                                        (height / 16) * Tt.headerY +
                                            height / 16 +
                                            floor(width / 48) / 3 +
                                            (height / 24) *
                                                (1 === Tt.editorMode ? g : 0),
                                        floor(width / 48) / 3,
                                        floor(width / 48) / 3
                                    )
                                ) {
                                    jn(e, "sections");
                                    break;
                                }
                            0 < Tt.sectionsSelected.length &&
                                Tt.sectionsNSM.click();
                        }
                        if (!1 === Tt.menu)
                            for (e = 0; e < Tt.tools.length; e++)
                                if (
                                    Ft(
                                        "rcorner",
                                        (width / Tt.tools.length) * e,
                                        height - (height / 16) * Tt.headerY,
                                        width / Tt.tools.length,
                                        (height / 16) * -(Tt.toolsH + 1)
                                    )
                                )
                                    0 === e && en(),
                                        1 === e && kn("objType"),
                                        2 === e &&
                                            (1 === Tt.playbackRate
                                                ? (Tt.playbackRate = 0.5)
                                                : 0.5 === Tt.playbackRate &&
                                                  (Tt.playbackRate = 1),
                                            (Tt.timeStart = millis()),
                                            (Tt.playingOffset = Tt.time)),
                                        4 === e && kn("clickMode"),
                                        5 === e &&
                                            (Tt.metronome = !Tt.metronome),
                                        6 === e && zn(),
                                        7 === e && kn("editMode"),
                                        e === Tt.tools.length - 1 &&
                                            (Tt.menu = !0);
                                else if (!1 !== Tt.tools[e][3])
                                    for (
                                        var c, d = 0;
                                        d < Tt.tools[e][3].length;
                                        d++
                                    )
                                        Ft(
                                            "rcorner",
                                            (width / Tt.tools.length) * e +
                                                (width /
                                                    Tt.tools.length /
                                                    Tt.tools[e][3].length) *
                                                    d,
                                            height -
                                                (height / 32) *
                                                    (Tt.toolsH + 1) *
                                                    (4 * Tt.tools[e][2]),
                                            width /
                                                Tt.tools.length /
                                                Tt.tools[e][3].length,
                                            (height / 16) * (Tt.toolsH + 1)
                                        ) &&
                                            (1 === e
                                                ? ((c = d),
                                                  -1 ===
                                                  (c =
                                                      1 === Tt.objType
                                                          ? d - 1
                                                          : c)
                                                      ? kn("holdLength")
                                                      : 0 === c
                                                      ? Ni({
                                                            hue: [
                                                                Tt,
                                                                "beatColor",
                                                            ],
                                                            saturation: [
                                                                Tt,
                                                                "beatSaturation",
                                                            ],
                                                            brightness: [
                                                                Tt,
                                                                "beatBrightness",
                                                            ],
                                                            mode: HSB,
                                                            title: "edit_select_item_beatColor",
                                                        })
                                                      : 1 === c
                                                      ? mouseButton === LEFT
                                                          ? (Tt.transitionIn =
                                                                Tt.transitionIn >=
                                                                Tt
                                                                    .transitionNames
                                                                    .length -
                                                                    1
                                                                    ? 0
                                                                    : Tt.transitionIn +
                                                                      1)
                                                          : mouseButton ===
                                                                RIGHT &&
                                                            (Tt.transitionIn =
                                                                Tt.transitionIn <=
                                                                0
                                                                    ? Tt
                                                                          .transitionNames
                                                                          .length -
                                                                      1
                                                                    : Tt.transitionIn -
                                                                      1)
                                                      : 2 === c &&
                                                        (mouseButton === LEFT
                                                            ? (Tt.transitionOut =
                                                                  Tt.transitionOut >=
                                                                  Tt
                                                                      .transitionNames
                                                                      .length -
                                                                      1
                                                                      ? 0
                                                                      : Tt.transitionOut +
                                                                        1)
                                                            : mouseButton ===
                                                                  RIGHT &&
                                                              (Tt.transitionOut =
                                                                  Tt.transitionOut <=
                                                                  0
                                                                      ? Tt
                                                                            .transitionNames
                                                                            .length -
                                                                        1
                                                                      : Tt.transitionOut -
                                                                        1)))
                                                : 3 === e &&
                                                  (0 === d
                                                      ? kn("timelineSnap")
                                                      : 1 === d
                                                      ? ((J = Tt.timelineBPM),
                                                        Tt.playing && en(),
                                                        Ri({
                                                            var: [
                                                                Tt,
                                                                "timelineBPM",
                                                            ],
                                                            title: "edit_tool_bpm_inp",
                                                            type: "number",
                                                            allowEmpty: !1,
                                                            after: function () {
                                                                var e =
                                                                    Tt.timelineBPM /
                                                                    Tt.bpm;
                                                                (Tt.time =
                                                                    (Ot(
                                                                        (Tt.time /
                                                                            J) *
                                                                            Tt.timelineBPM *
                                                                            e *
                                                                            (1 /
                                                                                Tt.snap)
                                                                    ) *
                                                                        Tt.snap) /
                                                                    e),
                                                                    (Tt.editorHSStart =
                                                                        !1),
                                                                    (Tt.metronomeLast =
                                                                        !1);
                                                            },
                                                        }))
                                                      : 2 === d
                                                      ? ((_ =
                                                            Tt.timelineOffset),
                                                        Tt.playing && en(),
                                                        Ri({
                                                            var: [
                                                                Tt,
                                                                "timelineOffset",
                                                            ],
                                                            title: "edit_tool_bpm_offset_inp",
                                                            type: "number",
                                                            allowEmpty: !1,
                                                            after: function () {
                                                                (Tt.time +=
                                                                    (Tt.bpm /
                                                                        60 /
                                                                        1e3) *
                                                                    (Tt.timelineOffset -
                                                                        _)),
                                                                    (Tt.editorHSStart =
                                                                        !1),
                                                                    (Tt.metronomeLast =
                                                                        !1);
                                                            },
                                                        }))
                                                      : 3 === d
                                                      ? An()
                                                      : 4 === d &&
                                                        (Tt.playing && en(),
                                                        (Tt.jumpToTimestamp =
                                                            !1),
                                                        Ri({
                                                            var: [
                                                                Tt,
                                                                "jumpToTimestamp",
                                                            ],
                                                            title: "edit_tool_timestamp",
                                                            type: "string",
                                                            allowEmpty: !0,
                                                            after: function () {
                                                                var e;
                                                                null !==
                                                                    Tt.jumpToTimestamp &&
                                                                    !1 !==
                                                                        (e = Ii(
                                                                            Tt.jumpToTimestamp
                                                                        )) &&
                                                                    (Tt.time =
                                                                        e);
                                                            },
                                                            display: Xt({
                                                                recieve: "bpm",
                                                                time: Tt.time,
                                                                bpm: Tt.timelineBPM,
                                                                offset: Tt.timelineOffset,
                                                                lvlBPM: Tt.bpm,
                                                            }),
                                                        }))));
                    }
                else
                    Tt.exiting
                        ? ((r = (width / 2 - 2 * kt) / 1.5),
                          (h = height / 4 / 1.5),
                          Ft(
                              "rcorner",
                              width / 4 - r / 2,
                              (height / 4) * 2.5 - h / 4,
                              r,
                              h
                          ) && ((Tt.buttonHover[2] /= 2), yn()),
                          Ft(
                              "rcorner",
                              (width / 4) * 3 - r / 2,
                              (height / 4) * 2.5 - h / 4,
                              r,
                              h
                          ) && ((Tt.buttonHover[3] /= 2), (Tt.exiting = !1)))
                        : (Tt.menuNSM.click(),
                          Ft(
                              "rcorner",
                              (width / Tt.tools.length) * (Tt.tools.length - 1),
                              height - (height / 16) * Tt.headerY,
                              width / Tt.tools.length,
                              (height / 16) * -(Tt.toolsH + 1)
                          ) && (Tt.menu = !1));
            } else if (multiplayer.code == "") {
                Tt.paused &&
                    1 === Tt.disMode &&
                    !1 === Tt.resumeTime &&
                    (Ft(
                        "rcorner",
                        width / 2 - width / 4 / 2,
                        height / 2 - height / 8 / 2 - (height / 8) * 1.25,
                        width / 4,
                        height / 8
                    )
                        ? Mn("continue")
                        : Ft(
                              "rcorner",
                              width / 2 - width / 4 / 2,
                              height / 2 - height / 8 / 2,
                              width / 4,
                              height / 8
                          ) && Mn("retry"),
                    Ft(
                        "rcorner",
                        width / 2 - width / 4 / 2,
                        height / 2 - height / 8 / 2 + (height / 8) * 1.25,
                        width / 4,
                        height / 8
                    )) &&
                    Mn("menu");
            }
        2 === Tt.disMode &&
            !1 === Tt.edit &&
            (Ft(
                "rcorner",
                (width / 3) * 2 + kt,
                height - height / 8 - kt,
                width / 3 - 2 * kt,
                height / 8
            )
                ? Mn("menu")
                : Ft(
                      "rcorner",
                      (width / 3) * 2 + kt,
                      height - (height / 8) * 2 - 2 * kt,
                      width / 3 - 2 * kt,
                      height / 8
                  )
                ? Mn("retry")
                : Tt.performanceDotCallback && Tt.performanceDotCallback());
    }
};

// Re-pasting all fs.screens functions necessary

(fs.screens.accountSignedIn = function () {
    0 < T.uuid.length && !Bt.account.countryScreen && !Bt.account.friendsScreen
        ? us()
        : Bt.account.countryScreen
        ? vs()
        : !1 !== Bt.account.friendsScreen && !1 === Bt.account.viewFriend
        ? ms()
        : !1 !== Bt.account.friendsScreen &&
          !1 !== Bt.account.viewFriend &&
          $n("account");
}),
    (fs.screens.accountSignedOut = function () {
        var e = width > height ? width / 64 : height / 64;
        Bt.account.overlayOn
            ? (Ft(
                  "rcorner",
                  3 * e,
                  height / 16 + (height / 32) * 3 + 7 * e + (height / 16) * 8,
                  width / 8,
                  height / 16
              )
                  ? ("haveCode" === Bt.account.mode
                        ? (Bt.account.mode = "resetPassword")
                        : "resetPasswordConf" === Bt.account.mode
                        ? (Bt.account.mode = "haveCode")
                        : ((Bt.account.overlayOn = !1),
                          (Bt.account.user = ""),
                          (Bt.account.email = ""),
                          (Bt.account.pass = ""),
                          (Bt.account.passConf = ""),
                          (Bt.account.code = ""),
                          (Bt.account.codeUuid = "")),
                    (Bt.account.errors = []),
                    (Bt.account.blankErrors = []),
                    (Bt.account.takenErrors = []),
                    (Bt.account.resetPassComplete = !1),
                    (Bt.account.buttonHover[2] /= 2))
                  : Ft(
                        "rcorner",
                        4 * e + width / 8,
                        height / 16 +
                            (height / 32) * 3 +
                            7 * e +
                            (height / 16) * 8,
                        width / 8,
                        height / 16
                    ) &&
                    ("signup" === Bt.account.mode
                        ? hn()
                        : "login" === Bt.account.mode
                        ? an()
                        : "resetPassword" === Bt.account.mode
                        ? fn()
                        : "haveCode" === Bt.account.mode
                        ? un()
                        : "resetPasswordConf" === Bt.account.mode && vn(),
                    (Bt.account.buttonHover[3] /= 2)),
              "signup" === Bt.account.mode
                  ? Ft(
                        "rcorner",
                        3 * e,
                        height / 16 + (height / 32) * 3 + 3 * e + height / 16,
                        width / 2,
                        height / 16
                    )
                      ? Ri({
                            var: [Bt.account, "user"],
                            title: "menu_account_username",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (Bt.account.blankErrors[0] ||
                                    Bt.account.takenErrors[0]) &&
                                    0 < Bt.account.user.length &&
                                    ((Bt.account.blankErrors[0] = !1),
                                    (Bt.account.takenErrors[0] = !1));
                            },
                        })
                      : Ft(
                            "rcorner",
                            3 * e,
                            height / 16 +
                                (height / 32) * 3 +
                                4 * e +
                                (height / 16) * 3,
                            width / 2,
                            height / 16
                        )
                      ? Ri({
                            var: [Bt.account, "email"],
                            title: "menu_account_email",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (Bt.account.blankErrors[1] ||
                                    Bt.account.takenErrors[1]) &&
                                    0 < Bt.account.email.length &&
                                    ((Bt.account.blankErrors[1] = !1),
                                    (Bt.account.takenErrors[1] = !1));
                            },
                        })
                      : Ft(
                            "rcorner",
                            3 * e,
                            height / 16 +
                                (height / 32) * 3 +
                                5 * e +
                                (height / 16) * 5,
                            width / 2,
                            height / 16
                        )
                      ? Ri({
                            var: [Bt.account, "pass"],
                            title: "menu_account_password",
                            type: "string",
                            allowEmpty: !0,
                            password: !0,
                            after: function () {
                                Bt.account.blankErrors[2] &&
                                    0 < Bt.account.pass.length &&
                                    (Bt.account.blankErrors[2] = !1);
                            },
                        })
                      : Ft(
                            "rcorner",
                            3 * e,
                            height / 16 +
                                (height / 32) * 3 +
                                6 * e +
                                (height / 16) * 7,
                            width / 2,
                            height / 16
                        ) &&
                        Ri({
                            var: [Bt.account, "passConf"],
                            title: "menu_account_passwordConfirm",
                            type: "string",
                            allowEmpty: !0,
                            password: !0,
                            after: function () {
                                Bt.account.blankErrors[3] &&
                                    0 < Bt.account.passConf.length &&
                                    (Bt.account.blankErrors[3] = !1);
                            },
                        })
                  : "login" === Bt.account.mode
                  ? Ft(
                        "rcorner",
                        3 * e,
                        height / 16 + (height / 32) * 3 + 3 * e + height / 16,
                        width / 2,
                        height / 16
                    )
                      ? Ri({
                            var: [Bt.account, "email"],
                            title: "menu_account_email",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (Bt.account.blankErrors[1] ||
                                    Bt.account.takenErrors[1]) &&
                                    0 < Bt.account.email.length &&
                                    ((Bt.account.blankErrors[1] = !1),
                                    (Bt.account.takenErrors[1] = !1));
                            },
                        })
                      : Ft(
                            "rcorner",
                            3 * e,
                            height / 16 +
                                (height / 32) * 3 +
                                4 * e +
                                (height / 16) * 3,
                            width / 2,
                            height / 16
                        ) &&
                        Ri({
                            var: [Bt.account, "pass"],
                            title: "menu_account_password",
                            type: "string",
                            allowEmpty: !0,
                            password: !0,
                            after: function () {
                                Bt.account.blankErrors[2] &&
                                    0 < Bt.account.pass.length &&
                                    (Bt.account.blankErrors[2] = !1);
                            },
                        })
                  : "resetPassword" === Bt.account.mode
                  ? Ft(
                        "rcorner",
                        3 * e,
                        height / 16 + (height / 32) * 3 + 3 * e + height / 16,
                        width / 2,
                        height / 16
                    )
                      ? Ri({
                            var: [Bt.account, "user"],
                            title: "menu_account_username",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (Bt.account.blankErrors[0] ||
                                    Bt.account.takenErrors[0]) &&
                                    0 < Bt.account.user.length &&
                                    ((Bt.account.blankErrors[0] = !1),
                                    (Bt.account.takenErrors[0] = !1));
                            },
                        })
                      : Ft(
                            "rcorner",
                            3 * e,
                            height / 16 +
                                (height / 32) * 3 +
                                4 * e +
                                (height / 16) * 3,
                            width / 2,
                            height / 16
                        )
                      ? Ri({
                            var: [Bt.account, "email"],
                            title: "menu_account_email",
                            type: "string",
                            allowEmpty: !0,
                            after: function () {
                                (Bt.account.blankErrors[1] ||
                                    Bt.account.takenErrors[0]) &&
                                    0 < Bt.account.email.length &&
                                    ((Bt.account.blankErrors[1] = !1),
                                    (Bt.account.takenErrors[0] = !1));
                            },
                        })
                      : Ft(
                            "rcorner",
                            5 * e + (width / 8) * 2,
                            height / 16 +
                                (height / 32) * 3 +
                                7 * e +
                                (height / 16) * 8,
                            width / 2 - 2 * e - (width / 8) * 2,
                            height / 16
                        ) &&
                        ((Bt.account.mode = "haveCode"),
                        (Bt.account.errors = []),
                        (Bt.account.blankErrors = []),
                        (Bt.account.takenErrors = []))
                  : "haveCode" === Bt.account.mode
                  ? Ft(
                        "rcorner",
                        3 * e,
                        height / 16 + (height / 32) * 3 + 3 * e + height / 16,
                        width / 2,
                        height / 16
                    ) &&
                    Ri({
                        var: [Bt.account, "code"],
                        title: "menu_account_code",
                        type: "string",
                        allowEmpty: !0,
                        after: function () {
                            (Bt.account.blankErrors[4] ||
                                Bt.account.takenErrors[4]) &&
                                0 < Bt.account.code.length &&
                                ((Bt.account.blankErrors[4] = !1),
                                (Bt.account.takenErrors[4] = !1));
                        },
                    })
                  : "resetPasswordConf" === Bt.account.mode &&
                    (Ft(
                        "rcorner",
                        3 * e,
                        height / 16 + (height / 32) * 3 + 3 * e + height / 16,
                        width / 2,
                        height / 16
                    )
                        ? Ri({
                              var: [Bt.account, "pass"],
                              title: "menu_account_passwordNew",
                              type: "string",
                              allowEmpty: !0,
                              password: !0,
                              after: function () {
                                  Bt.account.blankErrors[2] &&
                                      0 < Bt.account.pass.length &&
                                      (Bt.account.blankErrors[2] = !1);
                              },
                          })
                        : Ft(
                              "rcorner",
                              3 * e,
                              height / 16 +
                                  (height / 32) * 3 +
                                  4 * e +
                                  (height / 16) * 3,
                              width / 2,
                              height / 16
                          ) &&
                          Ri({
                              var: [Bt.account, "passConf"],
                              title: "menu_account_passwordConfirm",
                              type: "string",
                              allowEmpty: !0,
                              password: !0,
                              after: function () {
                                  Bt.account.blankErrors[3] &&
                                      0 < Bt.account.passConf.length &&
                                      (Bt.account.blankErrors[3] = !1);
                              },
                          })))
            : Ft(
                  "rcorner",
                  e,
                  height / 16 + (height / 32) * 3 + 2 * e,
                  width / 4,
                  height / 8
              )
            ? ((Bt.account.mode = "signup"),
              (Bt.account.overlayOn = !0),
              (Bt.account.buttonHover[0] /= 2))
            : Ft(
                  "rcorner",
                  e,
                  height / 16 + (height / 32) * 3 + height / 8 + 3 * e,
                  width / 4,
                  height / 8
              )
            ? ((Bt.account.mode = "login"),
              (Bt.account.overlayOn = !0),
              (Bt.account.buttonHover[1] /= 2))
            : Ft(
                  "rcorner",
                  e,
                  height / 16 + (height / 32) * 3 + (height / 8) * 2 + 4 * e,
                  width / 4,
                  height / 8
              ) &&
              ((Bt.account.mode = "resetPassword"),
              (Bt.account.overlayOn = !0),
              (Bt.account.buttonHover[4] /= 2));
    }),
    (fs.screens.click = function () {
        (He = "welcome"), eo(), (s.startTime = millis());
    }),
    (fs.screens.logo = function () {
        Ft(
            "rcorner",
            width - 7 * kt,
            height - 7 * kt * (s.strC[3] / 255),
            6 * kt,
            6 * kt
        )
            ? (p(), (Bt.lvl.buttonHover[19] /= 2))
            : ((Bt.screen = "main trans"), (s.pulse = 0));
    }),
    (fs.screens.header = function () {
        // --- EDITED CODE (X to leave lobby in multiplayer lobby)
        if (multiplayer.code == "") {
            Ft(
                "rcorner",
                height / 64 - height / 128 / 4,
                height / 64 - height / 128 / 4,
                height / 32 + height / 128 / 2,
                height / 32 + height / 128 / 2
            ) && (Bt.side = !Bt.side);
        } else {
            Ft(
                "rcorner",
                height / 64 - height / 128 / 4,
                height / 64 - height / 128 / 4,
                height / 32 + height / 128 / 2,
                height / 32 + height / 128 / 2
            ) &&
                ((multiplayer.code = ""),
                (multiplayer.roomUsers = {}),
                Server.logOff());
        }
    }),
    (fs.screens.nav = function () {
        for (var e = 0; e < Bt.nav.length; e++)
            mouseX < abs(width / 5 + (width / 5) * Bt.sideX) &&
            mouseY > height / 16 + (height / 16) * e + height / 16 / 2 &&
            mouseY <
                height / 16 +
                    (height / 16) * e +
                    (height / 16 + height / 16 / 2)
                ? Bt.nav[e][1] !== Bt.screen
                    ? ((Bt.trans = Bt.nav[e][1]),
                      Bt.song.listening &&
                          ((Rt = []),
                          (Rt = O.search),
                          (Bt.song.listening = !1),
                          soundManager.pause(Rt[Bt.song.sel]),
                          soundManager.setVolume(
                              "menuMusic",
                              Bt.settings.menuMusicVolume
                          )))
                    : (Bt.side = !1)
                : mouseX > abs((width / 5) * Bt.sideW + Bt.sideX) &&
                  mouseY > height / 16 &&
                  (Bt.side = !1);
    });

function Yo(e) {
    if ("lvl" === e) {
        for (var t = 0; t < Ht.saved.length; t++)
            !0 === Ht.saved[t].local &&
                void 0 !== Ht.saved[t].id &&
                ((Ht.saved[t] = Ht.saved[t].id),
                (Ht.onlineScores[Ht.saved[t]] = Ht.scores[t]));
        Bt.lvl.searchSent ||
            (0 === Bt.lvl.search.length
                ? Io(0, "recent", Bt.lvl.tab, Bt.lvl.sortMode)
                : 0 !== Bt.lvl.search.length &&
                  Io(
                      Bt.lvl.search,
                      Bt.lvl.searchMode,
                      Bt.lvl.tab,
                      Bt.lvl.sortMode
                  )),
            !0 !== Ne && (Rt = Uo(Ht.search, Bt.lvl.sortMode)),
            (z = Bt.lvl.sel),
            (Ve = Bt.lvl.tab);
    } else
        "song" === e &&
            (0 === O.search.length &&
                (0 === Bt.song.search.length
                    ? Ao(0, "recent", Bt.song.tab)
                    : 0 !== Bt.song.search.length &&
                      Ao(Bt.song.search, Bt.song.searchMode, Bt.song.tab)),
            (Rt = Uo(O.search, Bt.song.sortMode)),
            (z = Bt.song.sel),
            (Ve = Bt.song.tab));
    var i = width > height ? width / 64 : height / 64;
    if (void 0 !== Rt[z]) {
        if ("lvl" === e) {
            fill(0, 25),
                rect(
                    width / 3 + i,
                    height / 16 + i,
                    (((width / 3) * 2) / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                ),
                imageMode(CENTER),
                Po(
                    width / 3 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    height / 16 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    Bn(Rt[z]),
                    H(Rt[z], "id").ranked,
                    H(Rt[z], "id").special
                ),
                fill($.text),
                textAlign(LEFT, CENTER),
                Dt(
                    (!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).title,
                    width / 3 +
                        3 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i),
                    height / 16 +
                        2 * i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i) / 2,
                    (((width / 3) * 2) / 3) * 2 -
                        2 * i -
                        3 * i -
                        (((height - height / 16) / 3 - 2 * i) / 2 - i),
                    ((height - height / 16) / 3 - 2 * i) / 2 - i,
                    "bold"
                );
            var o = (
                !0 === Rt[z].local
                    ? Ut(Rt[z].author, "uuid")
                    : Ut(H(Rt[z], "id").author, "uuid")
            ).user;
            Dt(
                Pt(
                    "menu_lvl_by",
                    xt,
                    void 0 === o ? Pt("defaultUsername", xt) : o
                ),
                width / 3 + 2 * i,
                height / 16 + 2 * i + ((height - height / 16) / 3 - 2 * i) / 2,
                (((width / 3) * 2) / 3) * 2 - 2 * i - 2 * i,
                ((height - height / 16) / 3 - 2 * i) / 4 - i
            ),
                Dt(
                    Pt(
                        "menu_lvl_song",
                        xt,
                        (!0 === Rt[z].local
                            ? Lt(Rt[z].song, "id")
                            : Lt(H(Rt[z], "id").song, "id")
                        ).artist,
                        (!0 === Rt[z].local
                            ? Lt(Rt[z].song, "id")
                            : Lt(H(Rt[z], "id").song, "id")
                        ).name
                    ),
                    width / 3 + 2 * i,
                    height / 16 +
                        1.5 * i +
                        ((height - height / 16) / 3 - 2 * i) / 2 +
                        ((height - height / 16) / 3 - 2 * i) / 4,
                    (((width / 3) * 2) / 3) * 2 - 2 * i - 2 * i,
                    ((height - height / 16) / 3 - 2 * i) / 4 - i
                ),
                !0 ===
                    Lt((!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).song, "id")
                        .explicit &&
                    (imageMode(CORNER),
                    Wt(
                        St.explicit,
                        "stretch",
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) -
                            2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    ),
                    Ft(
                        "rcorner",
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) -
                            2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    )) &&
                    ($t = Pt("explicit", xt)),
                fill(0, 25),
                rect(
                    width / 3 + i + ((((width / 3) * 2) / 3) * 2 - 2 * i) + i,
                    height / 16 + i,
                    ((width / 3) * 2) / 3 - i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                );
            textAlign(LEFT, CENTER);
            for (t = 0; t < 8; t++) {
                var o = "",
                    n = !1;
                0 === t
                    ? (o =
                          void 0 === (o = !0 === Rt[z].local ? Rt[z].id : Rt[z])
                              ? Pt("menu_lvl_notUploaded", xt) +
                                (void 0 !== Rt[z].copy
                                    ? " " +
                                      Pt("menu_lvl_copyID", xt, Rt[z].copy)
                                    : "")
                              : Pt("menu_lvl_ID", xt, o))
                    : 1 === t
                    ? (!0 === Rt[z].local
                          ? (o = $i(Pn(Rt[z].beat, Rt[z].bpm)))
                          : void 0 !== (o = H(Rt[z], "id").bpmDis) &&
                            (o =
                                !0 === o[0]
                                    ? Pt(
                                          "menu_lvl_foresight_range",
                                          xt,
                                          $i(o[1] * Tt.mods.bpm),
                                          $i(o[2] * Tt.mods.bpm)
                                      )
                                    : $i(o * Tt.mods.bpm)),
                      (o = Pt("menu_lvl_bpm", xt, o)),
                      1 !== Tt.mods.bpm && (n = !0))
                    : 2 === t
                    ? (!0 === Rt[z].local
                          ? (o = $i(En(Rt[z].effects, Rt[z].ar)))
                          : void 0 !== (o = H(Rt[z], "id").arDis) &&
                            (o =
                                !0 === o[0]
                                    ? Pt(
                                          "menu_lvl_foresight_range",
                                          xt,
                                          $i(o[1] * Tt.mods.foresight),
                                          $i(o[2] * Tt.mods.foresight)
                                      )
                                    : $i(o * Tt.mods.foresight)),
                      (o = Pt("menu_lvl_foresight", xt, o)),
                      1 !== Tt.mods.foresight && (n = !0))
                    : 3 === t
                    ? ((o = (!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).hw),
                      (w = (!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).ar),
                      (o = null == o ? w : o),
                      (o *= Tt.mods.hitWindow),
                      (o = Pt("menu_lvl_hitWindow", xt, $i(o))),
                      1 !== Tt.mods.hitWindow && (n = !0))
                    : 4 === t
                    ? ((o = (!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).hpD),
                      (o = Pt("menu_lvl_hpD", xt, $i(o))))
                    : 5 === t
                    ? ((o = Wo(
                          (!0 === Rt[z].local
                              ? Lo(Rt[z].beat, Rt[z].bpm)
                              : H(Rt[z], "id").len) *
                              (1 / Tt.mods.bpm),
                          "min:sec"
                      )),
                      (o = Pt("menu_lvl_length", xt, o)),
                      1 !== Tt.mods.bpm && (n = !0))
                    : 6 === t
                    ? (o = Hn(floor(100 * Bn(Rt[z])) / 100))
                    : 7 === t &&
                      (o = H(Rt[z], "id").ranked
                          ? H(Rt[z], "id").special
                              ? Pt("menu_lvl_special", xt)
                              : Pt("menu_lvl_ranked", xt)
                          : Pt("menu_lvl_unranked", xt)),
                    n ? fill($.modText) : fill($.text),
                    Dt(
                        o,
                        width / 3 +
                            i +
                            ((((width / 3) * 2) / 3) * 2 - 2 * i) +
                            2 * i,
                        height / 16 +
                            1.75 * i +
                            (((height - height / 16) / 3 - 4 * i) / 8) *
                                (t + 1) -
                            ((height - height / 16) / 3 - 3 * i) / 8 / 4,
                        ((width / 3) * 2) / 3 - i - 2 * i,
                        ((height - height / 16) / 3 - 4 * i) / 8
                    );
            }
            fill($.lightTheme ? 0 : 255),
                ellipse(
                    width / 3 +
                        i +
                        ((((width / 3) * 2) / 3) * 2 - 2 * i) +
                        i +
                        ((width / 3) * 2) / 3 -
                        i -
                        1.5 * i,
                    height / 16 +
                        i +
                        (height - height / 16) / 3 -
                        2 * i -
                        1.5 * i,
                    1.5 * i,
                    1.5 * i
                ),
                (Bt.lvl.refreshArrowR += At(0, Bt.lvl.refreshArrowR, 0.1)),
                !Ft(
                    "ccenter",
                    width / 3 +
                        i +
                        ((((width / 3) * 2) / 3) * 2 - 2 * i) +
                        i +
                        ((width / 3) * 2) / 3 -
                        i -
                        1.5 * i,
                    height / 16 +
                        i +
                        (height - height / 16) / 3 -
                        2 * i -
                        1.5 * i,
                    1.5 * i,
                    1.5 * i
                ) ||
                    Bt.lvl.showLeaderboard ||
                    Bt.lvl.showMods ||
                    (($t = Pt("menu_lvl_refresh", xt)),
                    -0.1 <= Bt.lvl.refreshArrowR &&
                        (Bt.lvl.refreshArrowR += At(
                            -0.1,
                            Bt.lvl.refreshArrowR,
                            0.2
                        ))),
                push(),
                translate(
                    width / 3 +
                        i +
                        ((((width / 3) * 2) / 3) * 2 - 2 * i) +
                        i +
                        ((width / 3) * 2) / 3 -
                        i -
                        1.5 * i,
                    height / 16 +
                        i +
                        (height - height / 16) / 3 -
                        2 * i -
                        1.5 * i
                ),
                rotate(360 * Bt.lvl.refreshArrowR),
                imageMode(CENTER),
                Wt(
                    $.lightTheme ? St.refreshInvert : St.refresh,
                    "stretch",
                    0,
                    0,
                    0.8 * i,
                    0.8 * i
                ),
                pop(),
                fill(0, 25),
                rect(
                    width / 3 + i,
                    height / 16 + i + ((height - height / 16) / 3 - 2 * i) + i,
                    (width / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                ),
                fill($.main),
                rect(
                    width / 3 + i,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        (((height - height / 16) / 3 - 2 * i) / 2 - i / 2 / 2),
                    (width / 3) * 2 - 2 * i,
                    i / 2
                ),
                fill($.text),
                textAlign(CENTER, CENTER);
            (o =
                null == (o = (!0 === Rt[z].local ? Rt[z] : H(Rt[z], "id")).desc)
                    ? ""
                    : o),
                textSize(i / 1.25),
                text(
                    0 < o.length
                        ? '"' + o + '"'
                        : Pt("menu_lvl_noDescription", xt),
                    (width / 3) * 2 - ((width / 3) * 2 - 2 * i) / 2,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                            2 /
                            2 -
                        ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                            2 /
                            2 -
                        i / 2 / 2,
                    (width / 3) * 2 - 2 * i,
                    ((height - height / 16) / 3 - 2 * i + i / 2 / 2) / 2
                );
            var t = null;
            if (0 < Bt.lvl.leaderboardData.length)
                for (var s = 0; s < Bt.lvl.leaderboardData.length; s++)
                    s < Bt.lvl.leaderboardData.length &&
                        Bt.lvl.leaderboardData[s].user === T.uuid &&
                        (t = s);
            if (
                (null !== t && !0 !== Rt[z].local && H(Rt[z], "id").ranked
                    ? (push(),
                      translate(
                          0,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                                  2 /
                                  2 -
                              i / 4
                      ),
                      noStroke(),
                      fill($.text),
                      rectMode(CENTER),
                      textAlign(CENTER, CENTER),
                      Dt(
                          t + 1,
                          width / 3 + 2.5 * i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 16) * 0 +
                              (height - height / 16) / 12 / 2,
                          2 * i,
                          2 * i,
                          "bold"
                      ),
                      imageMode(CENTER),
                      x(Ut(Bt.lvl.leaderboardData[t].user, "uuid").pp) &&
                          Wt(
                              _t(Ut(Bt.lvl.leaderboardData[t].user, "uuid").pp),
                              "stretch",
                              width / 3 + 5.5 * i,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 16) * 0 +
                                  (height - height / 16) / 12 / 2,
                              2 * i,
                              2 * i
                          ),
                      textAlign(LEFT, CENTER),
                      (h = Ut(Bt.lvl.leaderboardData[t].user, "uuid").user),
                      Dt(
                          (h =
                              void 0 !== Bt.lvl.leaderboardData[t].mods &&
                              null !== Bt.lvl.leaderboardData[t].mods &&
                              Bt.lvl.leaderboardData[t].mods !== Tt.modsDef
                                  ? h +
                                    "\n" +
                                    Vo(Bt.lvl.leaderboardData[t].mods)
                                  : h),
                          width / 3 +
                              7.5 * i +
                              ((width / 3) * 2 - 12 * i - i) / 4 -
                              ((width / 3) * 2 - 12 * i - i) / 2 / 2,
                          height / 16 +
                              i +
                              ((height - height / 16) / 16) * 0 +
                              (height - height / 16) / 12 / 2,
                          ((width / 3) * 2 - i) / 2,
                          (2 * i) / 2
                      ),
                      textAlign(RIGHT, CENTER),
                      Dt(
                          Ot(
                              Bt.lvl.leaderboardData[t].score *
                                  wn(Bt.lvl.leaderboardData[t].mods)
                          ) +
                              "\n" +
                              Pt(
                                  "performancePoints",
                                  xt,
                                  floor(
                                      100 *
                                          Bt.lvl.leaderboardData[t].performance
                                  ) / 100
                              ),
                          width / 3 +
                              8.5 * i +
                              0.75 * ((width / 3) * 2 - 12 * i - i) +
                              ((width / 3) * 2 - 12 * i - i) / 2 / 2,
                          height / 16 +
                              i +
                              ((height - height / 16) / 16) * 0 +
                              (height - height / 16) / 12 / 2,
                          ((width / 3) * 2 - 12 * i - i) / 2,
                          (2 * i) / 2
                      ),
                      textAlign(CENTER, CENTER),
                      (h = constrain(
                          tn(
                              (Bt.lvl.leaderboardData[t].score *
                                  wn(Bt.lvl.leaderboardData[t].mods)) /
                                  rn(Rt[Bt.lvl.sel], "online")
                          ),
                          0,
                          Tt.ranks.length - 1
                      )),
                      fill(on(h)),
                      Dt(
                          Tt.ranks[h].symbol,
                          width / 3 + 10.5 * i + ((width / 3) * 2 - 12 * i - i),
                          height / 16 +
                              i +
                              ((height - height / 16) / 16) * 0 +
                              (height - height / 16) / 12 / 2,
                          2 * i,
                          2 * i,
                          "bold"
                      ),
                      pop())
                    : !0 !== Rt[z].local && H(Rt[z], "id").ranked
                    ? Dt(
                          Pt("menu_lvl_noScore", xt),
                          (width / 3) * 2,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                                  2 /
                                  2 +
                              ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                                  2,
                          (width / 3) * 2 - 5 * i - 2 * i,
                          ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                              2 /
                              3
                      )
                    : Dt(
                          Pt("menu_lvl_noLeaderboard", xt),
                          (width / 3) * 2,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                                  2 /
                                  2 +
                              ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                                  2,
                          (width / 3) * 2 - 5 * i - 2 * i,
                          ((height - height / 16) / 3 - 2 * i + i / 2 / 2) /
                              2 /
                              3
                      ),
                !0 === Rt[z].local
                    ? (Kt(
                          width / 3 + i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i,
                          ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                          ((height - height / 16) / 3 / 3) * 2 - i / 2,
                          Pt("menu_lvl_play", xt),
                          Bt.lvl.buttonHover,
                          0
                      ),
                      Kt(
                          width / 3 +
                              i +
                              (((width / 3) * 2 - 2 * i) / 2 - i / 2) +
                              i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i,
                          ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                          ((height - height / 16) / 3 / 3) * 2 - i / 2,
                          Pt("menu_lvl_edit", xt),
                          Bt.lvl.buttonHover,
                          2
                      ),
                      Kt(
                          width / 3 + i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 / 3) * 2 +
                              i / 2,
                          ((width / 3) * 2 - 4 * i) / 3,
                          (height - height / 16) / 3 / 3 - i / 2,
                          Pt("menu_lvl_delete", xt),
                          Bt.lvl.buttonHover,
                          1
                      ),
                      Kt(
                          width / 3 + 2 * i + ((width / 3) * 2 - 4 * i) / 3,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 / 3) * 2 +
                              i / 2,
                          ((width / 3) * 2 - 4 * i) / 3,
                          (height - height / 16) / 3 / 3 - i / 2,
                          Pt("menu_lvl_mods", xt),
                          Bt.lvl.buttonHover,
                          12
                      ),
                      void 0 === Rt[z].copy
                          ? Kt(
                                width / 3 +
                                    3 * i +
                                    (((width / 3) * 2 - 4 * i) / 3) * 2,
                                height / 16 +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    i / 2,
                                ((width / 3) * 2 - 4 * i) / 3,
                                (height - height / 16) / 3 / 3 - i / 2,
                                Pt("menu_lvl_upload", xt),
                                Bt.lvl.buttonHover,
                                3
                            )
                          : void 0 !== Rt[z].copy && Rt[z].author === T.uuid
                          ? Kt(
                                width / 3 +
                                    3 * i +
                                    (((width / 3) * 2 - 4 * i) / 3) * 2,
                                height / 16 +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    i / 2,
                                ((width / 3) * 2 - 4 * i) / 3,
                                (height - height / 16) / 3 / 3 - i / 2,
                                Pt("menu_lvl_uploadCopy", xt),
                                Bt.lvl.buttonHover,
                                3
                            )
                          : (fill(255),
                            Dt(
                                Pt("menu_lvl_notUploadCopy", xt),
                                width / 3 +
                                    3 * i +
                                    (((width / 3) * 2 - 4 * i) / 3) * 2 +
                                    ((width / 3) * 2 - 4 * i) / 3 / 2,
                                height / 16 +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    i / 2 +
                                    ((height - height / 16) / 3 / 3 - i / 2) /
                                        2,
                                ((width / 3) * 2 - 4 * i) / 3,
                                (height - height / 16) / 3 / 3 - i / 2
                            )))
                    : ((h = qo(Rt[z])),
                      // --- EDITED CODE (Button visuals for choosing a map in multiplayer)
                      Kt(
                          width / 3 + i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i,
                          (width / 3) * 2 - 2 * i,
                          ((height - height / 16) / 3 / 3) * 2 - i / 2,
                          Pt(
                              0 === h
                                  ? "menu_download"
                                  : 2 === h
                                  ? multiplayer.code != ""
                                      ? "multiplayer_menu_select"
                                      : "menu_lvl_play"
                                  : "menu_downloading",
                              xt
                          ),
                          Bt.lvl.buttonHover,
                          4
                      ),
                      Kt(
                          width / 3 + i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 / 3) * 2 +
                              i / 2,
                          ((width / 3) * 2 - 4 * i) / 3,
                          (height - height / 16) / 3 / 3 - i / 2,
                          -1 !== Ht.saved.indexOf(Rt[z])
                              ? Pt("menu_lvl_unbookmark", xt)
                              : Pt("menu_lvl_bookmark", xt),
                          Bt.lvl.buttonHover,
                          5
                      ),
                      Kt(
                          width / 3 + 2 * i + ((width / 3) * 2 - 4 * i) / 3,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 / 3) * 2 +
                              i / 2,
                          ((width / 3) * 2 - 4 * i) / 3,
                          (height - height / 16) / 3 / 3 - i / 2,
                          Pt("menu_lvl_mods", xt),
                          Bt.lvl.buttonHover,
                          10
                      ),
                      !0 === H(Rt[Bt.lvl.sel], "id").ranked
                          ? Kt(
                                width / 3 +
                                    3 * i +
                                    (((width / 3) * 2 - 4 * i) / 3) * 2,
                                height / 16 +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    i / 2,
                                ((width / 3) * 2 - 4 * i) / 3,
                                (height - height / 16) / 3 / 3 - i / 2,
                                Pt("menu_lvl_leaderboard", xt),
                                Bt.lvl.buttonHover,
                                8
                            )
                          : "Metadata" !== H(Rt[Bt.lvl.sel], "id").beat &&
                            Kt(
                                width / 3 +
                                    3 * i +
                                    (((width / 3) * 2 - 4 * i) / 3) * 2,
                                height / 16 +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 - 2 * i) +
                                    i +
                                    ((height - height / 16) / 3 / 3) * 2 +
                                    i / 2,
                                ((width / 3) * 2 - 4 * i) / 3,
                                (height - height / 16) / 3 / 3 - i / 2,
                                Pt("edit_select_item_copy", xt),
                                Bt.lvl.buttonHover,
                                8
                            )),
                !0 !== Rt[z].local &&
                    H(Rt[z], "id").special &&
                    Ft(
                        "rcorner",
                        width / 3 + i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i,
                        (width / 3) * 2 - 2 * i,
                        ((height - height / 16) / 3 / 3) * 2 - i / 2
                    ) &&
                    !1 === Bt.lvl.showLeaderboard &&
                    !1 === Bt.lvl.showMods &&
                    ($t = Pt("menu_lvl_specialWarning", xt)),
                Bt.lvl.showLeaderboard
                    ? ((Bt.lvl.leaderboardX += At(1, Bt.lvl.leaderboardX, 0.2)),
                      (!Rt[Bt.lvl.sel].local &&
                          !0 === H(Rt[Bt.lvl.sel], "id").ranked) ||
                          (Bt.lvl.showLeaderboard = !1))
                    : (Bt.lvl.leaderboardX += At(0, Bt.lvl.leaderboardX, 0.2)),
                0 < Ot(100 * Bt.lvl.leaderboardX) / 100 &&
                    (push(),
                    translate(
                        -(
                            constrain(Bt.lvl.leaderboardX, 0, 1) *
                            ((width / 3) * 2)
                        ),
                        0
                    ),
                    fill(
                        lerpColor(
                            $.shade,
                            $.main,
                            constrain(Bt.lvl.leaderboardX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(width, height / 16, (width / 3) * 2, height),
                    push(),
                    translate((width / 3) * 2, 0),
                    (Bt.lvl.leaderboardData = pn(Rt[Bt.lvl.sel], "lvl")),
                    Bt.lvl.newLeaderboard.draw(Bt.lvl.leaderboardData, {
                        x: width / 3,
                        y: height / 16,
                        w: (width / 3) * 2,
                        h: height - height / 16 - height / 12,
                        buffer: height / 128,
                        scroll: [Bt.lvl, "leaderboardScroll"],
                        self: T.uuid,
                        levelID: Rt[Bt.lvl.sel],
                    }),
                    pop(),
                    (h = floor(height / 12)),
                    translate((width / 3) * 2, height - h),
                    fill(
                        lerpColor(
                            $.shade,
                            $.overlayShade,
                            constrain(Bt.lvl.leaderboardX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(width / 3, 0, width, h),
                    (h = h - i),
                    translate(width / 3, 0),
                    "Loading..." !== Bt.lvl.leaderboardData &&
                        Kt(
                            width / 3 - width / 6 - i / 2,
                            i / 2,
                            width / 6,
                            h,
                            Pt("refresh", xt),
                            Bt.lvl.buttonHover,
                            14
                        ),
                    Kt(
                        width / 3 + i / 2,
                        i / 2,
                        width / 6,
                        h,
                        Pt("menu_back", xt),
                        Bt.lvl.buttonHover,
                        9
                    ),
                    pop()),
                Bt.lvl.showMods
                    ? (Bt.lvl.modsX += At(1, Bt.lvl.modsX, 0.2))
                    : (Bt.lvl.modsX += At(0, Bt.lvl.modsX, 0.2)),
                0 < Ot(100 * Bt.lvl.modsX) / 100 &&
                    (push(),
                    translate(
                        -(constrain(Bt.lvl.modsX, 0, 1) * ((width / 3) * 2)),
                        0
                    ),
                    fill(
                        lerpColor(
                            $.shade,
                            $.main,
                            constrain(Bt.lvl.modsX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(width, height / 16, (width / 3) * 2, height),
                    push(),
                    Bt.lvl.modsNSM.draw({
                        x: width,
                        y: height / 16,
                        width: (width / 3) * 2,
                        height:
                            height -
                            ((height - height / 16) / 3 / 3 - i / 2 + 2 * i) -
                            height / 16,
                        stacked: !1,
                        maxBarHeight: height / 24,
                        buffer: (height - height / 16) / 64,
                        mouseIsPressedBlock: vt.active,
                    }),
                    pop(),
                    translate((width / 3) * 2, 0),
                    fill(
                        lerpColor(
                            $.shade,
                            $.overlayShade,
                            constrain(Bt.lvl.modsX, 0, 1)
                        )
                    ),
                    rectMode(CORNER),
                    rect(
                        width / 3,
                        height / 16 +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2,
                        width,
                        (height - height / 16) / 3 / 3 - i / 2 + 2 * i
                    ),
                    Kt(
                        width / 3 + i + (((width / 3) * 2 - 2 * i) / 2 + i / 2),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            (((height - height / 16) / 3 / 3 - i / 2) / 4) * 3 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2,
                        Pt("menu_back", xt),
                        Bt.lvl.buttonHover,
                        11
                    ),
                    Kt(
                        width / 3 + i + (((width / 3) * 2 - 2 * i) / 2 + i / 2),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            (((height - height / 16) / 3 / 3 - i / 2) / 4) * 3 -
                            i / 2 -
                            ((height - height / 16) / 3 / 3 - i / 2) / 2 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2,
                        Pt("mods_practice", xt),
                        Bt.lvl.buttonHover,
                        15
                    ),
                    fill($.text),
                    textAlign(LEFT, CENTER),
                    Dt(
                        Pt("mods_scoreMultiplier", xt, wn(Tt.mods)),
                        width / 3 + i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            ((height - height / 16) / 3 / 3 - i / 2) / 4 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2
                    ),
                    Kt(
                        width / 3 + i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 / 3) * 2 +
                            i / 2 +
                            (((height - height / 16) / 3 / 3 - i / 2) / 4) * 3 -
                            i / 2,
                        ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                        ((height - height / 16) / 3 / 3 - i / 2) / 2,
                        Pt("mods_reset", xt),
                        Bt.lvl.buttonHover,
                        13
                    ),
                    pop()),
                (vt.trans += At(vt.active ? 1 : 0, vt.trans, 0.2)),
                0 < Math.round(100 * vt.trans) / 100)
            ) {
                vt.computeSections(), (vt.callback = null), push();
                var r = (width / 3) * 2,
                    h = height - height / 16,
                    a = width - constrain(vt.trans, 0, 1) * ((width / 3) * 2),
                    l = height / 16,
                    d =
                        (translate(a, l),
                        fill(
                            lerpColor(
                                $.shade,
                                $.main,
                                constrain(vt.trans, 0, 1)
                            )
                        ),
                        rectMode(CORNER),
                        rect(0, 0, r, h),
                        r - 2 * i),
                    g = ((h / 8) * 7) / vt.sections.length;
                for (let e = 0; e < vt.sections.length; e++) {
                    push();
                    var c = g * (e + 0.5);
                    translate(0, c),
                        fill(
                            lerpColor(
                                $.main,
                                e % 2 != 0 ? $.main : $.shade,
                                0.5
                            )
                        ),
                        rect(0, -g / 2, r, g),
                        pop();
                }
                fill($.text), textAlign(LEFT, CENTER);
                for (let e = 0; e < vt.sections.length; e++) {
                    const P = vt.sections[e];
                    push();
                    var f = g * (e + 0.5),
                        u =
                            (translate(0, f),
                            Dt(P.name, i, 0, d / 2 - 2 * i, Math.min(g, 4 * i)),
                            d / 2 / 2),
                        v = g / 1.5;
                    e !== vt.sections.length - 1 &&
                        (Kt(
                            d / 2 + i / 2,
                            -v / 2,
                            u,
                            v,
                            Pt("practice_startAt", xt),
                            vt.buttonHover,
                            2 * e,
                            {
                                alert: Tt.mods.startPos === P.startMS,
                            }
                        ),
                        Ft(
                            "rcorner",
                            d / 2 + i / 2 + a,
                            -v / 2 + l + f,
                            u,
                            v
                        )) &&
                        (vt.callback = () => {
                            (vt.buttonHover[2 * e] /= 4),
                                (Tt.mods.startPos = P.startMS),
                                console.log("Start " + P.name);
                        }),
                        0 !== e &&
                            (Kt(
                                d / 2 + i + u,
                                -v / 2,
                                u,
                                v,
                                Pt("practice_endBefore", xt),
                                vt.buttonHover,
                                2 * e + 1,
                                {
                                    alert: Tt.mods.endPos === P.startMS,
                                }
                            ),
                            Ft(
                                "rcorner",
                                d / 2 + i + u + a,
                                -v / 2 + l + f,
                                u,
                                v
                            )) &&
                            (vt.callback = () => {
                                (vt.buttonHover[2 * e + 1] /= 4),
                                    (Tt.mods.endPos = P.startMS),
                                    console.log("End " + P.name);
                            }),
                        pop();
                }
                fill(
                    lerpColor(
                        $.shade,
                        $.overlayShade,
                        constrain(vt.trans, 0, 1)
                    )
                ),
                    rect(0, (h / 8) * 7, r, h / 7);
                var m = r / 2 - 2 * i,
                    p = h / 8 / 1.5;
                Kt(
                    r - m - i,
                    h - h / 8 + (h / 8 - p) / 2,
                    m,
                    p,
                    Pt("menu_back", xt),
                    vt.buttonHover,
                    -1
                ),
                    Ft(
                        "rcorner",
                        r - m - i + a,
                        h - h / 8 + (h / 8 - p) / 2 + l,
                        m,
                        p
                    ) && (vt.callback = () => (vt.active = !1)),
                    pop();
            }
            !0 === Rt[z].local
                ? (Ht.localOffsets[Ht.saved.indexOf(Rt[z])] = Tt.mods.offset)
                : (Ht.onlineOffsets[Rt[z]] = Tt.mods.offset);
        } else
            "song" === e &&
                (fill(0, 25),
                rect(
                    width / 3 + i,
                    height / 16 + i,
                    (width / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                ),
                !0 === Lt(Rt[Bt.song.sel], "id").explicit &&
                    (Wt(
                        St.explicit,
                        "stretch",
                        width / 3 + i + ((width / 3) * 2 - 2 * i) - 2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    ),
                    Ft(
                        "rcorner",
                        width / 3 + i + ((width / 3) * 2 - 2 * i) - 2.25 * i,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) -
                            2.25 * i,
                        1.5 * i,
                        1.5 * i
                    )) &&
                    ($t = Pt("explicit", xt)),
                textAlign(CENTER, CENTER),
                fill($.text),
                Dt(
                    Pt(
                        "menu_lvl_song_list",
                        xt,
                        Lt(Rt[Bt.song.sel], "id").artist,
                        Lt(Rt[Bt.song.sel], "id").name
                    ),
                    width / 3 + i + ((width / 3) * 2 - 2 * i) / 2,
                    height / 16 + i + ((height - height / 16) / 3 - 2 * i) / 2,
                    (width / 3) * 2 - 2 * i - 2 * i,
                    ((height - height / 16) / 3 - 2 * i) / 3
                ),
                Dt(
                    Pt("menu_lvl_ID", xt, Rt[Bt.song.sel]),
                    width / 3 + i + ((width / 3) * 2 - 2 * i) / 2,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) / 2 +
                        ((height - height / 16) / 3 - 2 * i) / 3 / 2 +
                        i,
                    (width / 3) * 2 - 2 * i - 2 * i,
                    ((height - height / 16) / 3 - 2 * i) / 3 / 2
                ),
                fill(0, 25),
                rect(
                    width / 3 + i,
                    height / 16 + i + ((height - height / 16) / 3 - 2 * i) + i,
                    (width / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 - 2 * i,
                    i
                ),
                (Bt.song.songObject = soundManager.getSoundById(Rt[z])),
                imageMode(CORNER),
                Bt.song.listening
                    ? 3 === Bt.song.songObject.readyState
                        ? image(
                              1 === Bt.settings.themeSel
                                  ? St.stopInvert
                                  : St.stop,
                              width / 3 + i + i,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) / 2 -
                                  i,
                              2 * i,
                              2 * i
                          )
                        : ((Bt.song.loadR += 0.25),
                          (Bt.song.loadR = Bt.song.loadR % 360),
                          push(),
                          fill($.text),
                          translate(
                              width / 3 + i + i,
                              height / 16 +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) +
                                  i +
                                  ((height - height / 16) / 3 - 2 * i) / 2 -
                                  i
                          ),
                          translate((2 * i) / 2, (2 * i) / 2),
                          rotate(Bt.song.loadR),
                          rectMode(CENTER),
                          rect(0, 0, 2 * i, 2 * i),
                          pop())
                    : image(
                          1 === Bt.settings.themeSel ? St.playInvert : St.play,
                          width / 3 + i + i,
                          height / 16 +
                              i +
                              ((height - height / 16) / 3 - 2 * i) +
                              i +
                              ((height - height / 16) / 3 - 2 * i) / 2 -
                              i,
                          2 * i,
                          2 * i
                      ),
                rectMode(CORNER),
                fill($.textDown),
                rect(
                    width / 3 + i + i + (i + 2 * i),
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i) / 2 -
                        i / 4 / 2,
                    (width / 3) * 2 - 4 * i - (i + 2 * i),
                    i / 4,
                    i / 4
                ),
                void 0 !== Bt.song.songObject &&
                    3 === Bt.song.songObject.readyState &&
                    (mouseIsPressed &&
                    Ft(
                        "rcorner",
                        width / 3 + i + i + (i + 2 * i),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) / 2 -
                            i / 4 / 2 -
                            i / 2,
                        (width / 3) * 2 - 4 * i - (i + 2 * i),
                        i
                    )
                        ? (soundManager.setPosition(
                              Rt[z],
                              ((mouseX - (width / 3 + i + i + (i + 2 * i))) /
                                  ((width / 3) * 2 - 4 * i - (i + 2 * i))) *
                                  Bt.song.songObject.duration
                          ),
                          soundManager.setVolume(Rt[z], 0))
                        : soundManager.setVolume(
                              Rt[z],
                              Bt.settings.musicVolume
                          ),
                    (0 === Bt.song.songObject.playState ||
                        Bt.song.songObject.paused) &&
                        Bt.song.listening &&
                        soundManager.play(Rt[z]),
                    textAlign(LEFT, CENTER),
                    fill($.text),
                    Dt(
                        Wo(Bt.song.songObject.position, "min:sec") +
                            "/" +
                            Wo(Bt.song.songObject.duration, "min:sec"),
                        width / 3 + i + i + (i + 2 * i),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) / 2 -
                            i / 4 / 2 +
                            1.5 * i,
                        (width / 3) * 2 - 4 * i - (i + 2 * i),
                        i
                    ),
                    mouseIsPressed
                        ? ((Bt.song.playbackX += At(
                              Bt.song.songObject.position /
                                  Bt.song.songObject.duration,
                              Bt.song.playbackX,
                              0.4
                          )),
                          (Bt.song.playbackR += At(
                              (Bt.song.songObject.position /
                                  Bt.song.songObject.duration) *
                                  742.5,
                              Bt.song.playbackR,
                              0.4
                          )))
                        : ((Bt.song.playbackX += At(
                              Bt.song.songObject.position /
                                  Bt.song.songObject.duration,
                              Bt.song.playbackX,
                              0.1 / (21e4 / Bt.song.songObject.duration)
                          )),
                          (Bt.song.playbackR += At(
                              (Bt.song.songObject.position /
                                  Bt.song.songObject.duration) *
                                  742.5,
                              Bt.song.playbackR,
                              0.1 / (21e4 / Bt.song.songObject.duration)
                          ))),
                    Ft(
                        "rcenter",
                        width / 3 +
                            i +
                            i +
                            (i + 2 * i) +
                            ((width / 3) * 2 - 4 * i - (i + 2 * i)) *
                                Bt.song.playbackX,
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) / 2 -
                            i / 4 / 2 +
                            i / 8,
                        i,
                        i
                    )
                        ? mouseIsPressed
                            ? (Bt.song.playbackS += At(
                                  1.25,
                                  Bt.song.playbackS,
                                  0.2
                              ))
                            : (Bt.song.playbackS += At(
                                  1,
                                  Bt.song.playbackS,
                                  0.2
                              ))
                        : (Bt.song.playbackS += At(
                              0.75,
                              Bt.song.playbackS,
                              0.2
                          )),
                    push(),
                    translate(
                        width / 3 + i + i + (i + 2 * i),
                        height / 16 +
                            i +
                            ((height - height / 16) / 3 - 2 * i) +
                            i +
                            ((height - height / 16) / 3 - 2 * i) / 2 -
                            i / 4 / 2
                    ),
                    translate(
                        ((width / 3) * 2 - 4 * i - (i + 2 * i)) *
                            Bt.song.playbackX,
                        i / 8
                    ),
                    rotate(Bt.song.playbackR),
                    scale(Bt.song.playbackS),
                    rectMode(CENTER),
                    fill($.text),
                    rect(0, 0, i, i),
                    pop()),
                Kt(
                    width / 3 + i,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i,
                    (width / 3) * 2 - 2 * i,
                    ((height - height / 16) / 3 / 3) * 2 - i / 2,
                    Pt("menu_song_copyID", xt),
                    Bt.song.buttonHover,
                    4
                ),
                Kt(
                    width / 3 + i,
                    height / 16 +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 - 2 * i) +
                        i +
                        ((height - height / 16) / 3 / 3) * 2 +
                        i / 2,
                    (width / 3) * 2 - 2 * i,
                    (height - height / 16) / 3 / 3 - i / 2,
                    -1 !== O.saved.indexOf(Rt[z])
                        ? Pt("menu_lvl_unbookmark", xt)
                        : Pt("menu_lvl_bookmark", xt),
                    Bt.song.buttonHover,
                    5
                ));
        Bt.lvl.deleteConfirm || Bt.lvl.uploadConfirm
            ? (Bt.lvl.deleteBanner += At(1, Bt.lvl.deleteBanner, 0.2))
            : (Bt.lvl.deleteBanner += At(0, Bt.lvl.deleteBanner, 0.2)),
            push(),
            rectMode(CORNER),
            fill($.overlayShade),
            rect(
                (-width / 3) * 2 + (width / 3) * 3 * Bt.lvl.deleteBanner,
                height - (height - height / 16) / 3 - 1.5 * i,
                (width / 3) * 2,
                (height - height / 16) / 3 + i
            ),
            fill($.text),
            Kt(
                (-width / 3) * 2 + i + (width / 3) * 3 * Bt.lvl.deleteBanner,
                height / 16 +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 / 3) * 2 +
                    i / 2,
                ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                (height - height / 16) / 3 / 3 - i / 2,
                Pt(
                    Bt.lvl.uploadConfirm
                        ? "menu_lvl_upload_yes"
                        : "menu_lvl_delete_yes",
                    xt
                ),
                Bt.lvl.buttonHover,
                6
            ),
            Kt(
                (-width / 3) * 2 +
                    i +
                    (((width / 3) * 2 - 2 * i) / 2 - i / 2) +
                    i +
                    (width / 3) * 3 * Bt.lvl.deleteBanner,
                height / 16 +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 / 3) * 2 +
                    i / 2,
                ((width / 3) * 2 - 2 * i) / 2 - i / 2,
                (height - height / 16) / 3 / 3 - i / 2,
                Pt("menu_lvl_delete_no", xt),
                Bt.lvl.buttonHover,
                7
            ),
            push(),
            translate(
                ((width / 3) * 2 - 2 * i) / 2 +
                    (width / 3) * 3 * Bt.lvl.deleteBanner,
                (((height - height / 16) / 3 / 3) * 2 - i / 2) / 2
            ),
            fill($.text),
            Dt(
                Pt(
                    Bt.lvl.uploadConfirm
                        ? void 0 === Rt[Bt.lvl.sel].copy
                            ? "menu_lvl_upload_confirm"
                            : "menu_lvl_uploadUpdate_confirm"
                        : "menu_lvl_delete_confirm",
                    xt,
                    Rt[z].title
                ),
                (-width / 3) * 2 + i,
                height / 16 +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i +
                    ((height - height / 16) / 3 - 2 * i) +
                    i,
                (width / 3) * 2 - 2 * i,
                (((height - height / 16) / 3 / 3) * 2 - i / 2) / 1.5
            ),
            pop(),
            pop();
    }
    rectMode(CORNER),
        fill($.overlayShade),
        rect(0, height / 16, width / 3, height);
    for (t = 0; t < Rt.length; t++) {
        var b =
            height / 16 +
            height / 24 +
            (height / 12) * t -
            (Rt.length > (height - (height / 16 + height / 24)) / (height / 12)
                ? (Bt.lvl.scroll /
                      (height -
                          (height / 16 + height / 24) -
                          (height - (height / 16 + height / 24)) / 12)) *
                  ((height / 12) *
                      (Rt.length -
                          (height - (height / 16 + height / 24)) /
                              (height / 12)))
                : 0);
        b < height &&
            0 < b &&
            (push(),
            translate(0, b),
            z === t
                ? fill($.select)
                : fill(
                      lerpColor(
                          t % 2 != 0 ? $.shade : $.overlayShade,
                          color(0, 0, 0),
                          0.15
                      )
                  ),
            rect(0, 0, width / 3, height / 12),
            "lvl" === e
                ? (imageMode(CENTER),
                  Po(
                      (width < height ? width : height) / 16 / 2 + i / 4,
                      height / 12 / 2,
                      (width < height ? width : height) / 16,
                      (width < height ? width : height) / 16,
                      Bn(Rt[t]),
                      H(Rt[t], "id").ranked,
                      H(Rt[t], "id").special
                  ),
                  push(),
                  translate(
                      (width < height ? width : height) / 16 + (i / 4) * 2,
                      0
                  ),
                  textAlign(LEFT, CENTER),
                  fill($.text),
                  Dt(
                      (!0 === Rt[t].local ? Rt[t] : H(Rt[t], "id")).title,
                      0,
                      height / 12 / 4,
                      width / 3 -
                          width / 48 -
                          ((width < height ? width : height) / 16 +
                              (i / 4) * 4),
                      height / 12 / 2 / 1.5,
                      "bold"
                  ),
                  (o = (
                      !0 === Rt[t].local
                          ? Ut(Rt[t].author, "uuid")
                          : Ut(H(Rt[t], "id").author, "uuid")
                  ).user),
                  Dt(
                      Pt(
                          "menu_lvl_by",
                          xt,
                          void 0 === o ? Pt("defaultUsername", xt) : o
                      ),
                      0,
                      height / 12 / 2 + height / 12 / 16,
                      width / 3 -
                          width / 48 -
                          ((width < height ? width : height) / 16 +
                              (i / 4) * 4),
                      height / 12 / 4 / 1.5
                  ),
                  Dt(
                      Pt(
                          "menu_lvl_song_list",
                          xt,
                          (!0 === Rt[t].local
                              ? Lt(Rt[t].song, "id")
                              : Lt(H(Rt[t], "id").song, "id")
                          ).artist,
                          (!0 === Rt[t].local
                              ? Lt(Rt[t].song, "id")
                              : Lt(H(Rt[t], "id").song, "id")
                          ).name
                      ),
                      0,
                      height / 12 / 2 + height / 12 / 4,
                      width / 3 -
                          width / 48 -
                          ((width < height ? width : height) / 16 +
                              (i / 4) * 4),
                      height / 12 / 4 / 1.5
                  ),
                  pop(),
                  void 0 ===
                      Lt(
                          (!0 === Rt[t].local ? Rt[t] : H(Rt[t], "id")).song,
                          "id"
                      ).name && (Rt[t].song = 1203),
                  !0 ===
                      Lt(
                          (!0 === Rt[t].local ? Rt[t] : H(Rt[t], "id")).song,
                          "id"
                      ).explicit &&
                      (imageMode(CENTER),
                      Wt(
                          St.explicit,
                          "stretch",
                          i / 2 + (width / 3 - width / 48 - i - 1.25 * i),
                          height / 12 / 2,
                          Ot(1.5 * i),
                          Ot(1.5 * i)
                      ),
                      Ft(
                          "rcenter",
                          i / 2 + (width / 3 - width / 48 - i - 1.25 * i),
                          height / 12 / 2 + b,
                          Ot(1.5 * i),
                          Ot(1.5 * i)
                      )) &&
                      ($t = Pt("explicit", xt)))
                : "song" === e &&
                  (fill($.text),
                  textAlign(LEFT, CENTER),
                  Dt(
                      Pt(
                          "menu_lvl_song_list",
                          xt,
                          Lt(Rt[t], "id").artist,
                          Lt(Rt[t], "id").name
                      ),
                      i / 2,
                      height / 12 / 2,
                      width / 3 -
                          width / 48 -
                          i -
                          (!0 === Lt(Rt[t], "id").explicit ? 3 * i : 0),
                      height / 12 - i
                  ),
                  imageMode(CENTER),
                  !0 === Lt(Rt[t], "id").explicit) &&
                  (Wt(
                      St.explicit,
                      "stretch",
                      i / 2 + (width / 3 - width / 48 - i - 1.25 * i),
                      height / 12 / 2,
                      Ot(1.5 * i),
                      Ot(1.5 * i)
                  ),
                  Ft(
                      "rcenter",
                      i / 2 + (width / 3 - width / 48 - i - 1.25 * i),
                      height / 12 / 2 + b,
                      Ot(1.5 * i),
                      Ot(1.5 * i)
                  )) &&
                  ($t = Pt("explicit", xt)),
            pop());
    }
    fill(30),
        rect(width / 3 - width / 48, height / 16, width / 48, height),
        fill($.scrollbar),
        rect(
            width / 3 - width / 48,
            height / 16 + height / 24 + Bt.lvl.scroll,
            width / 48,
            (height - (height / 16 + height / 24)) / 12
        ),
        mouseIsPressed &&
            (Ft(
                "rcorner",
                width / 3 - width / 48,
                height / 16 + height / 24 + Bt.lvl.scroll,
                width / 48,
                (height - (height / 16 + height / 24)) / 12
            )
                ? ((Bt.lvl.scroll += mouseY - pmouseY),
                  (Bt.lvl.scrollNewLock = !0))
                : Ft(
                      "rcorner",
                      width / 3 - width / 48,
                      height / 16 + height / 24,
                      width / 48,
                      height
                  ) &&
                  ((Bt.lvl.scroll += At(
                      mouseY -
                          (height / 16 +
                              height / 24 +
                              (height - (height / 16 + height / 24)) / 12 / 2),
                      Bt.lvl.scroll,
                      0.5
                  )),
                  (Bt.lvl.scrollNewLock = !0))),
        0 !== Mt() &&
            ((Bt.lvl.showLeaderboard && mouseX < width / 3) ||
            !Bt.lvl.showLeaderboard
                ? Rt.length >
                  (height - (height / 16 + height / 24)) / (height / 12)
                    ? (Bt.lvl.scroll +=
                          (height /
                              12 /
                              2 /
                              ((height / 12) *
                                  (Rt.length -
                                      (height - (height / 16 + height / 24)) /
                                          (height / 12)))) *
                          (height -
                              (height / 16 + height / 24) -
                              (height - (height / 16 + height / 24)) / 12) *
                          (Mt() / 100))
                    : (Bt.lvl.scroll += (height / 12 / 2) * (Mt() / 100))
                : (Bt.lvl.leaderboardScroll += Mt() / 100)),
        (Vt *= 0.25),
        (Bt.lvl.scroll = constrain(
            Bt.lvl.scroll,
            0,
            height -
                (height / 16 +
                    height / 24 +
                    (height - (height / 16 + height / 24)) / 12)
        )),
        fill(30),
        rect(0, height / 16, width / 3 - width / 48, height / 24),
        push(),
        imageMode(CENTER),
        translate(height / 24 / 2, height / 24 / 2),
        fill(255),
        Wt(
            St.bookmark,
            "contain",
            0,
            height / 16,
            height / 24 / 1.5,
            height / 24 / 1.5
        ),
        fill(255),
        Wt(
            St.online,
            "contain",
            height / 24,
            height / 16,
            height / 24 / 1.5,
            height / 24 / 1.5
        ),
        "lvl" === e
            ? (fill(255),
              Wt(
                  St.ranked,
                  "contain",
                  (height / 24) * 2,
                  height / 16,
                  height / 24 / 1.5,
                  height / 24 / 1.5
              ),
              fill(255),
              Wt(
                  St.sort,
                  "contain",
                  (height / 24) * 3,
                  height / 16,
                  height / 24 / 1.5,
                  height / 24 / 1.5
              ),
              fill(255),
              Wt(
                  St.searchFor,
                  "contain",
                  (height / 24) * 4,
                  height / 16,
                  height / 24 / 1.5,
                  height / 24 / 1.5
              ))
            : "song" === e &&
              (fill(255),
              image(
                  St.sort,
                  (height / 24) * 2,
                  height / 16,
                  height / 24 / 1.5,
                  height / 24 / 1.5
              ),
              fill(255),
              Wt(
                  St.searchFor,
                  "contain",
                  (height / 24) * 3,
                  height / 16,
                  height / 24 / 1.5,
                  height / 24 / 1.5
              )),
        pop(),
        fill(255),
        imageMode(CENTER),
        Wt(
            "song" === e ? St.upload : St.edit,
            "contain",
            width / 3 - width / 48 / 2,
            height / 16 + height / 24 / 2,
            (width / 48 < height / 24 ? width / 48 : height / 24) / 1.5,
            (width / 48 < height / 24 ? width / 48 : height / 24) / 1.5
        );
    var w,
        C,
        y = "",
        h = ("lvl" === Bt.screen ? Bt.lvl : Bt.song).sortMode,
        E = ("lvl" === Bt.screen ? Bt.lvl : Bt.song).tab;
    switch (h) {
        default:
            y = "dateDesc";
            break;
        case "dateAsc":
            y = 0 === E ? "localAsc" : "dateAsc";
            break;
        case "dateDesc":
            y = 0 === E ? "localDesc" : "dateDesc";
            break;
        case "alphanumAsc":
            y = "alphanumAsc";
            break;
        case "alphanumDesc":
            y = "alphanumDesc";
            break;
        case "starsAsc":
            y = "starsAsc";
            break;
        case "starsDesc":
            y = "starsDesc";
    }
    "lvl" === e
        ? (!1 === Bt.side &&
              (Xo(
                  0,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_lvl_tab_local", xt),
                  Bt.lvl.tabHighlight,
                  0
              ),
              Xo(
                  height / 24,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_lvl_tab_online", xt),
                  Bt.lvl.tabHighlight,
                  1
              ),
              Xo(
                  (height / 24) * 2,
                  height / 16,
                  height / 24,
                  height / 24,
                  Bt.lvl.showUnranked
                      ? Pt("menu_lvl_showUnranked", xt)
                      : Pt("menu_lvl_hideUnranked", xt),
                  Bt.lvl.tabHighlight,
                  7
              ),
              Xo(
                  (height / 24) * 3,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_lvl_sort", xt, Pt("menu_lvl_sort_" + y, xt)),
                  Bt.lvl.tabHighlight,
                  4
              ),
              Xo(
                  (height / 24) * 4,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt(
                      "menu_lvl_searchFor",
                      xt,
                      Pt("menu_lvl_search_" + Bt.lvl.searchMode, xt)
                  ),
                  Bt.lvl.tabHighlight,
                  2
              )),
          Xo(
              width / 3 - width / 48,
              height / 16,
              width / 48,
              height / 24,
              Pt("menu_lvl_new", xt),
              Bt.lvl.tabHighlight,
              3
          ))
        : (!1 === Bt.side &&
              (Xo(
                  0,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_lvl_tab_bookmarks", xt),
                  Bt.song.tabHighlight,
                  0
              ),
              Xo(
                  height / 24,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_song_tab_online", xt),
                  Bt.song.tabHighlight,
                  1
              ),
              Xo(
                  (height / 24) * 2,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt("menu_lvl_sort", xt, Pt("menu_lvl_sort_" + y, xt)),
                  Bt.song.tabHighlight,
                  4
              ),
              Xo(
                  (height / 24) * 3,
                  height / 16,
                  height / 24,
                  height / 24,
                  Pt(
                      "menu_lvl_searchFor",
                      xt,
                      Pt("menu_lvl_search_" + Bt.song.searchMode, xt)
                  ),
                  Bt.song.tabHighlight,
                  2
              )),
          Xo(
              width / 3 - width / 48,
              height / 16,
              width / 48,
              height / 24,
              "" !== T.uuid
                  ? Pt("menu_lvl_newSong", xt)
                  : Pt("menu_newSong_noAccount", xt),
              Bt.song.tabHighlight,
              3
          )),
        fill(10),
        rect(
            (height / 24) * ("lvl" === e ? 5 : 4),
            height / 16,
            width / 3 - width / 48 - (height / 24) * ("lvl" === e ? 5 : 4),
            height / 24
        ),
        textAlign(LEFT, CENTER),
        "lvl" === e
            ? ((o =
                  0 === Bt.lvl.search.length
                      ? Pt("menu_lvl_search", xt)
                      : Bt.lvl.search),
              (w = 0 === Bt.lvl.search.length && "italics"),
              (C = 0 === Bt.lvl.search.length ? 127.5 : 255))
            : "song" === e &&
              ((o =
                  0 === Bt.song.search.length
                      ? Pt("menu_lvl_search", xt)
                      : Bt.song.search),
              (w = 0 === Bt.song.search.length && "italics"),
              (C = 0 === Bt.song.search.length ? 127.5 : 255)),
        fill(255, C),
        Dt(
            o,
            (height / 24) * ("lvl" === e ? 5 : 4) + height / 24 / 2 / 2,
            height / 16 + height / 24 / 2,
            width / 3 -
                width / 48 -
                (height / 24) * ("lvl" === e ? 5 : 4) -
                height / 24 / 2,
            height / 24 / 2,
            w
        ),
        "song" === e && Bt.song.overlayOn && ($t = !1);
}

//T9 here, the only reason im copying this function is to remove the god awful console flooding
cs.musicTime = function () {
    var e, t;
    1 === soundManager.getSoundById("menuMusic").playState &&
        (soundManager.stop("menuMusic"),
        soundManager.setVolume(Tt.song, Bt.settings.musicVolume)),
        !1 === Tt.edit &&
            (!1 === Tt.preLevelStart && (Tt.preLevelStart = millis()),
            5e3 <=
                millis() -
                    Tt.preLevelStart +
                    (Tt.songOffset + Tt.mods.offset + Bt.settings.offset) &&
            !Tt.songPlaying &&
            !Tt.paused
                ? (Qt[Tt.song].rate(Tt.mods.bpm),
                  Qt[Tt.song].volume(Bt.settings.musicVolume / 100),
                  (e = Qt[Tt.song].play()),
                  Qt[Tt.song].seek(
                      (Tt.songOffset + Tt.mods.offset + Bt.settings.offset) /
                          1e3 +
                          (0 === Tt.playingOffset
                              ? -5
                              : (Tt.playingOffset / 120) * 60),
                      e
                  ),
                  (Tt.songPlaying = !0))
                : Tt.paused && (Qt[Tt.song].pause(), (Tt.songPlaying = !1))),
        Tt.edit ||
            !1 !== Tt.songEnded ||
            Qt[Tt.song].on("end", function () {
                //console.log("ENDED SONG"),
                Tt.songEnded = [millis(), Qt[Tt.song].duration];
            }),
        !1 !== Tt.edit ||
            Tt.paused ||
            1 !== Tt.disMode ||
            (!1 !== Tt.songPlaying ||
            (!1 !== Ne && "hidden" !== Ne) ||
            !1 === Tt.preLevelStart //(console.log("Seek:" + Qt[Tt.song].seek()),
                ? ((t =
                      (((e =
                          !1 === Tt.songEnded
                              ? Qt[Tt.song].seek()
                              : Qt[Tt.song].duration() +
                                (!1 === Tt.songEnded
                                    ? 0
                                    : ((millis() - Tt.songEnded[0]) / 1e3) *
                                      Tt.mods.bpm)) -
                          (Tt.songOffset +
                              Tt.mods.offset +
                              Bt.settings.offset) /
                              1e3) *
                          (Tt.bpm / 60)) /
                      Tt.mods.bpm),
                  //console.log("Song pos:" + e),
                  //console.log("Next time:" + t),
                  (-1e3 < ((t - Tt.time) * Tt.mods.bpm) / (Tt.bpm / 60) ||
                      "set" === Tt.time) &&
                      (Tt.time = t))
                : (Tt.time =
                      ((millis() - Tt.preLevelStart - 5e3) / 1e3) *
                      (Tt.bpm / 60)));
    //console.log(Tt.time)))
};
