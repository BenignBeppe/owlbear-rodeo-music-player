import OBR from "@owlbear-rodeo/sdk";

function log(...message) {
    console.log(`${getPluginId()}:`, ...message);
}

function getPluginId(path) {
    return path ? `eu.sebber.music-player/${path}` : "eu.sebber.music-player";
}

function tryPlay() {
    log("Trying to start music...");
    player.play()
        .then(() => {
            log("Music started.");
        })
        .catch(() => {
            log(`Failed to start music. Retrying in ${retryDelay / 1000} seconds.`);
            setTimeout(tryPlay, retryDelay);
        });
}

async function tryInit() {
    // TODO: figure out a better solution to error "No scene found"
    // when isReady() returns true.
    log("Trying to initialise...");
    try {
        await init();
        log("Initialised.");
    } catch {
        log(`Failed to initialise. Retrying in ${retryDelay / 1000} seconds.`);
        setTimeout(tryInit, retryDelay);
    }
}

async function init() {
    let metadata = await OBR.scene.getMetadata();
    let currentTrackUrl = metadata[getPluginId("trackUrl")];
    player.setAttribute("src", currentTrackUrl);
    tryPlay();
    OBR.scene.onMetadataChange((metadata) => {
        let trackUrl = metadata[getPluginId("trackUrl")];
        if(trackUrl === currentTrackUrl) {
            return;
        }

        player.setAttribute("src", trackUrl);
        player.play();
        currentTrackUrl = trackUrl;
        updateTrackList();
    });
    updateTrackList();
}

async function updateTrackList() {
    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")];
    if(!tracks) {
        return;
    }

    let trackElements = [];
    let trackUrl = metadata[getPluginId("trackUrl")];
    let playingIndex = tracks.findIndex(t => t.url === trackUrl);
    for(let [index, track] of tracks.entries()) {
        let template = document.querySelector("#templates .track");
        let element = template.cloneNode(true);
        let label = element.querySelector(".label");
        label.textContent = track.name;
        label.addEventListener("click", changeTrack);
        let removeTrackButton = element.querySelector("#remove-track");
        removeTrackButton.addEventListener("click", removeTrack);
        if(index === playingIndex) {
            element.classList.add("playing");
        }

        trackElements.push(element);
    }
    let trackList = document.querySelector("#track-list");
    trackList.replaceChildren(...trackElements);
}

async function changeTrack(event) {
    let trackElement = event.target.closest(".track");
    let trackElements = Array.from(document.querySelectorAll("#track-list .track"));
    let index = trackElements.indexOf(trackElement);
    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")];
    let track = tracks[index];
    await OBR.scene.setMetadata({
        [getPluginId("trackUrl")]: track.url
    });
}

async function removeTrack(event) {
    let trackElement = event.target.closest(".track");
    let trackElements = Array.from(document.querySelectorAll("#track-list .track"));
    let index = trackElements.indexOf(trackElement);
    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")];
    let track = tracks[index];
    let confirmed = confirm(`Are you sure you want to remove track "${track.name}" from the list?`);
    if(!confirmed) {
        return;
    }

    tracks.splice(index, 1);
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Removed track "${track.name}" with URL ${track.url}.`);
    updateTrackList();
}

let player = document.querySelector("audio");
let retryDelay = 1000;
let currentTrackUrl = null;

let addTrackButton = document.querySelector("#add-track");
addTrackButton.addEventListener("click", async () => {
    let url = prompt("Enter URL to audio file:");
    if(!url) {
        return;
    }

    let metadata = await OBR.scene.getMetadata();
    let tracks = metadata[getPluginId("tracks")] || [];
    let matchingUrlTrack = tracks.find(t => t.url === url);
    if(matchingUrlTrack) {
        alert(
            "A track with that url is already in the list: " +
            `"${matchingUrlTrack.name}". New track will not be added.`
        );
        return;
    }

    let name = prompt("Enter name of track:");
    if(!name) {
        return;
    }

    tracks.push({
        name: name,
        url: url
    });
    await OBR.scene.setMetadata({
        [getPluginId("tracks")]: tracks
    });
    log(`Added track "${name}" with URL ${url}.`);
    updateTrackList();
});

OBR.onReady(async () => {
    if(OBR.scene.isReady()) {
        tryInit();
    } else {
        OBR.scene.onReadyChange((ready) => {
            if(ready) {
                init();
            }
        });
    }
});
