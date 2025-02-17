import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

function App() {
  const videoRef = useRef(null);
  const signalingSocket = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    signalingSocket.current = io(import.meta.env.VITE_WEBRTC_PUBLISHABLE_KEY);
    signalingSocket.current.on("connect", () => {
      console.log("Connected to signaling server");
    });

    signalingSocket.current.on("offer", async (offer) => {
      const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      };
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await signalingSocket.current.emit("ice-candidate", event.candidate);
        }
      };

      pc.ontrack = (event) => {
        console.log("Track received", event);
        let remoteStream = videoRef.current.srcObject;
        if (!remoteStream) {
          remoteStream = new MediaStream();
          videoRef.current.srcObject = remoteStream;
        }
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
          videoRef.current.srcObject = remoteStream;
        });

        videoRef.current
          .play()
          .catch((error) => console.error("Video play failed:", error));
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signalingSocket.current.emit("answer", answer); 
    });

    signalingSocket.current.on("ice-candidate", async (candidate) => {
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    return () => {
      if (signalingSocket.current) {
        signalingSocket.current.disconnect();
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, []);

  const handleDisconnect = () => {
    if (signalingSocket.current) {
      signalingSocket.current.disconnect();
      console.log("Manually disconnected from signaling server");
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
      console.log("Peer connection closed");
    }
    videoRef.current.srcObject = null;
  };

  return (
    <div className="w-full h-screen flex flex-col justify-start items-center">
      <video
        className="rounded-xl w-full h-3/4"
        ref={videoRef}
        autoPlay
        playsInline
        muted
      ></video>
      <br />
      <button
        onClick={handleDisconnect}
        className="bg-red-500 px-3 py-2 rounded-lg text-white"
      >
        Disconnect
      </button>
    </div>
  );
}

export default App;
