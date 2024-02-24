let APP_ID = "dc5db9f2725d40ecb386d4cd81a4baa7";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
//The client from which we login and have access to all these functions
let channel;
//The channel where two users join and send messages

//My device's video and audio
let localStream;

//Other's video and audio
let remoteStream;

let peerConnection;

//Creating stun servers
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

let init = async () => {

    client = await AgoraRTM.createInstance(APP_ID);
    //Creates an RTMClient Instance
    //Login and Logout of the agroa RTM system
    console.log(uid);
    // console.log(client);

    //Now login as client 
    await client.login({ uid: uid, token: null });

    //index.html?room=2234
    const channel = client.createChannel("main");

    // Join the channel
    // await channel.join();
    channel.join()
        .then(() => {
            console.log('Successfully joined the channel:', "main");
            // You can perform actions after successfully joining the channel
        })
        .catch((error) => {
            console.error('Error joining the channel:', error);
        });
    //This create channel will either find a channel of the name main, if there is not one then it will create a channel

    // join the channel 

    // event listeners 
    channel.on('MemberJoined', handleUserJoined);

    client.on("MessageFromPeer", handleMessageFromPeer);

    //function that seeks permission to acces camera and audio
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

    document.getElementById('user-1').srcObject = localStream;
    //srcObject is a property of  html media elements (video or audio) that allows us to stream our MediaStream into it.

}

let handleUserJoined = async (MemberId) => {
    console.log("New User has joined the chaannel: ", MemberId);
    createOffer(MemberId);
}

let handleMessageFromPeer = async (Message, MemberId) => {
    msg = JSON.parse(Message.text);

    if (msg.type === "offer") {
        //If the message type is the offer type that means the 1st peer has sent the offer to the second peer and the second peer needs to create the answer and send it to the 1st peer
        createAnswer(MemberId, msg.offer);
    }

    if (msg.type === 'answer') {
        //If the message type is the answer that means the 2nd peer has send the answer to the 1st peer  so we need to set it in the remote description
        addAnswer(msg.answer)
    }

    if (msg.type === 'candidate') {
        if (peerConnection) {
            //this will simply add the ice candidates to the peer connection that is recieved from ist remote peer.
            peerConnection.addIceCandidate(msg.candidate);
        }
    }

}

//This part of the code is needed in both the peers
let createPeerConnection = async (MemberId) => {

    peerConnection = new RTCPeerConnection(servers);
    // This is the main object in WebRTC for managing a connection between two peers.It handles tasks such as negotiating and managing the connection, adding and removing tracks, and dealing with ICE candidates.

    remoteStream = new MediaStream();
    //Media stream represents a stream of media content such as audio or video. Its fundamental application is to handle the real time communication in peer connection

    document.getElementById("user-2").srcObject = remoteStream;

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track, i) => {
        peerConnection.addTrack(track, localStream);
    });
    //In summary, this code is taking all the tracks from the localStream and adding each track to the peerConnection so that they can be transmitted to the remote peer in a WebRTC communication. This is a common pattern when setting up a WebRTC connection for audio/video communication.
    //Track it represents the stream which is the media captured from the devices


    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track, event.streams[0]);
        })
    }
    //PeerConnection onTrack method is triggered when a new track is received from the remote peer in the WebRTC session
    //Event param contain the information about the incoming track and 0th index represents the stream associated with the incoming track. basically we have to convert the stream coming from the other peer to the remote stream that's why the addTrack method is used 

    //Whenever we set the  description of a local connection ICE candidates are automatically created.

    peerConnection.onicecandidate = async (event) => {
        console.log(event);
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId);
            console.log("New ICE Candidates: ", event.candidate);
        }
    }
    //This onicecandidate function triggers whenever there is a ice candidate created in the peer connection
    //It has a event which consists of the icecandidates in the form event.candidates.

}

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    // This line generates an SDP(Session Description Protocol) offer, which is a text - based description of the local peer's media capabilities.

    await peerConnection.setLocalDescription(offer);
    // After creating the offer, you use setLocalDescription() to set this offer as the local session description of the peerConnection.The local description is a critical part of the WebRTC negotiation process.
    // Setting the local description is necessary before exchanging SDP offers and answers with the remote peer.It informs the local peer about its own media capabilities.


    console.log("Offer:", offer);
    //This offer is the SDP session of the Local peer this offer will be sent to the remote peer using the webSocket the remote will see the offer the save it as the remote spd as this sdp will we remote for the other peer then the other peer will generate the answer corresponding to the offer and set it as its Local Sdp

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId);
    //Sending message to the 2nd peer which will join later.

}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(offer);

    //As the 1st peer will create the offer
    //The second peer will create the answer her 
    //Offer and answer are the SDP the offer will the remote description for the 2nd peer and its local description will be the answer SDP. 
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    //Now we need to send the answer to the 1st peer whose local description is the offer
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId);

}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemotedescription) {
        await peerConnection.setRemoteDescription(answer);
    }
}

init();
