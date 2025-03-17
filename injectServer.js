let serverframe = document.createElement("iframe");
serverframe.src = "https://172.104.10.6/Server.html";
document.children[0].appendChild(serverframe);
serverframe.contentWindow.postMessage("GET", "*");
window.addEventListener("message", function(event) {
    console.log(event.data);
});