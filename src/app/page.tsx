"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSearchParams, useRouter } from "next/navigation";
import Slideshow from "./slideshow";

const socket = io("https://findom-chess.onrender.com");

const ChessGame = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [gameId, setGameId] = useState(searchParams.get("gameId") || null);
  const [playerColor, setPlayerColor] = useState(null);
  const [username, setUsername] = useState("User ");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [gameOver, setGameOver] = useState(null);
  const [kingInCheck, setKingInCheck] = useState(false);
  const [kingInCheckSquare, setKingInCheckSquare] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [fromSquare, setFromSquare] = useState(null); // For click-to-move
  const chatEndRef = useRef(null);

  const leftImages = ["/left/left1.jpg", "/left/left2.jpg", "/left/left3.jpg", "/left/left4.jpg", "/left/left5.jpg"];
  const rightImages = ["/right/right1.jpg", "/right/right2.jpg", "/right/right3.jpg", "/right/right4.jpg", "/right/right5.jpg"];
  const [leftImageIndex, setLeftImageIndex] = useState(0);
  const [rightImageIndex, setRightImageIndex] = useState(0);

  const [audio, setAudio] = useState(null);
  const [checkAudio, setCheckAudio] = useState(null);

  // Initialize the audio
  useEffect(() => {
    const newAudio = new Audio("/audios/audio.mp3");
    newAudio.loop = true;
    newAudio.volume = 0.5;
    setAudio(newAudio);

    const newCheckAudio = new Audio("/audios/check.mp3");
    newCheckAudio.volume = 1.0;
    setCheckAudio(newCheckAudio);
  }, []);

  // Play audio on user interaction
  useEffect(() => {
    const playAudio = () => {
      if (audio) {
        audio.play().catch((error) => {
          console.error("Audio autoplay blocked by browser:", error);
        });
      }
      window.removeEventListener("click", playAudio);
    };

    window.addEventListener("click", playAudio);

    return () => {
      window.removeEventListener("click", playAudio);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [audio]);

  useEffect(() => {
    if (!gameId) {
      const newGameId = Math.random().toString(36).substring(2, 10);
      setGameId(newGameId);
      router.push(`/?gameId=${newGameId}`);
    } else {
      socket.emit("joinGame", gameId);
    }

    socket.on("playerColor", (color) => {
      setPlayerColor(color);
      setUsername(color === "w" ? "Goddess" : "Subject");
    });

    socket.on("spectator", () => {
      setPlayerColor("spectator");
      setUsername(`Spectator ${Math.floor(Math.random() * 1000)}`);
    });

    socket.on("gameState", (newFen) => {
      chess.load(newFen);
      setFen(newFen);
      checkForCheck();
    });

    socket.on("gameOver", ({ winner }) => {
      setGameOver(
        winner === "draw"
          ? "Game Over: Draw"
          : `Game Over: ${winner === "w" ? "White Wins!" : "Black Wins!"}`
      );
    });

    socket.on("chatMessage", ({ user, text }) => {
      setMessages((prev) => [...prev, { user, text }]);
    });

    socket.on("typing", (user) => {
    setTypingUser(user);
    setIsTyping(true);

    // Clear previous timeout before setting a new one
    if (window.typingTimeout) {
      clearTimeout(window.typingTimeout);
    }

    // Hide "is typing" after 2 seconds
    window.typingTimeout = setTimeout(() => setIsTyping(false), 2000);
    });

    return () => {
      socket.off("gameState");
      socket.off("playerColor");
      socket.off("spectator");
      socket.off("gameOver");
      socket.off("chatMessage");
      socket.off("typing");
    };
  }, [gameId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLeftImageIndex((prev) => (prev + 1) % leftImages.length);
      setRightImageIndex((prev) => (prev + 1) % rightImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMove = (move) => {
    if (
      (playerColor === "w" && chess.turn() !== "w") ||
      (playerColor === "b" && chess.turn() !== "b") ||
      playerColor === "spectator"
    ) {
      return;
    }

    if (chess.move(move)) {
      setFen(chess.fen());
      socket.emit("move", { gameId, move, playerColor });
      checkForCheck();
    }
  };

  const checkForCheck = () => {
    const inCheck = chess.inCheck();
    setKingInCheck(inCheck);

    if (inCheck) {
      let whiteKingSquare = null;
      let blackKingSquare = null;

      chess.board().forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
          if (square && square.type === "k") {
            const file = "abcdefgh"[colIndex];
            const rank = 8 - rowIndex;
            const squareName = `${file}${rank}`;

            if (square.color === "w") {
              whiteKingSquare = squareName;
            } else {
              blackKingSquare = squareName;
            }
          }
        });
      });

      if (!whiteKingSquare || !blackKingSquare) {
        console.error("One of the kings is missing from the board.");
        return;
      }

      const kingSquare = chess.turn() === "w" ? whiteKingSquare : blackKingSquare;
      setKingInCheckSquare(kingSquare);

      if (checkAudio) {
        checkAudio.play().catch((error) => {
          console.error("Check audio playback error:", error);
        });
      }
    } else {
      setKingInCheckSquare(null);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chatMessage", { gameId, user: username, text: message });
      setMessage("");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      sendMessage();
    } 
  };

  const handleTyping = () => {
  socket.emit("typing", username);
  };

  const handleSquareClick = (square) => {
  const piece = chess.get(square);

  if (fromSquare === null) {
    // First selection: Ensure the clicked square has a piece of the player's color
    if (piece && piece.color === playerColor) {
      setFromSquare(square);
    }
  } else {
    if (square === fromSquare) {
      // Clicking the same square deselects the piece
      setFromSquare(null);
    } else if (piece && piece.color === playerColor) {
      // Selecting another piece of the same color updates selection
      setFromSquare(square);
    } else {
      // Attempt move through handleMove
      const move = { from: fromSquare, to: square, promotion: "q" };
      handleMove(move);
      setFromSquare(null);
    }
  }
};



  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getPlayerColorStyle = () => {
    if (playerColor === "w") return { color: "#f8b400" };
    if (playerColor === "b") return { color: "#007bff" };
    if (playerColor === "spectator") return { color: "#28a745" };
    return {};
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100vh", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: "10px", textAlign: "center" }}>
        <h2>Online Chess Game</h2>
        <p style={getPlayerColorStyle()}>Game ID: {gameId}</p>
        <p style={getPlayerColorStyle()}>
          You are: {playerColor === "spectator" ? username : playerColor === "w" ? "Goddess" : "Subject"}
        </p>
      </div>

      {gameOver ? (
        <div style={{ width: "400px", height: "400px", position: "relative" }}>
          <img
            src={
              gameOver.includes("White Wins!")
                ? "/game-over/white-wins.jpg"
                : gameOver.includes("Black Wins!")
                ? "/game-over/black-wins.jpg"
                : "/game-over/draw.jpg"
            }
            alt={gameOver}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "10px",
              objectFit: "cover",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Left Slideshow */}
          <Slideshow
            images={leftImages}
            position={{ top: "0%", left: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 1, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />


           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />



           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />


           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />




          {/* Right Slideshow */}
          <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />

           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />

           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />


           <Slideshow
            images={rightImages}
            position={{ top: "0%", right: "0%" }}
            size={{ width: "50vh", height: "75vh" }}
            opacityLevels={{ visible: 0, hidden: 0 }}
            fadeDuration={3}
            blankDuration={10}
          />





          {/* Chessboard */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "50vh",
              height: "50vh",
              position: "absolute",
            }}
          >
            <Chessboard
              position={fen}
              onPieceDrop={(source, target) => handleMove({ from: source, to: target, promotion: "q" })}
              onSquareClick={handleSquareClick}
              boardOrientation={playerColor === "b" ? "black" : "white"}
              boardStyle={{ borderRadius: "10px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.5)" }}
              customDarkSquareStyle={{ backgroundColor: "#EBB8DD" }}
              customLightSquareStyle={{ backgroundColor: "#FFFFFF" }}
              showBoardNotation={true}
              showLegalMoves={true}
              customSquareStyles={{
                [kingInCheckSquare]: { backgroundColor: "rgba(255, 0, 0, 0.5)" },
                ...(fromSquare && { [fromSquare]: { backgroundColor: "rgba(255, 255, 0, 0.5)" } }),
              }}
            />
          </div>
        </div>
      )}

      {/* Chat */}
      <div
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          width: "250px",
          backgroundColor: "rgba(34, 34, 34, 0.8)",
          padding: "10px",
          borderRadius: "8px",
        }}
      >
        <h4 style={{ color: "white" }}>Chat</h4>
        <div style={{ maxHeight: "150px", overflowY: "auto", color: "white" }}>
          {messages.map((msg, i) => (
            <p
              key={i}
              style={{
                fontSize: "14px",
                color:
                  msg.user.includes("Goddess") ? "gold" :
                  msg.user.includes("Subject") ? "blue" :
                  msg.user.includes("Spectator") ? "green" : "pink",
              }}
            >
              <strong>{msg.user}:</strong> {msg.text}
            </p>
          ))}
          {isTyping && <p style={{ color: "gray", fontSize: "12px" }}>{typingUser} is typing...</p>}
          <div ref={chatEndRef} />
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{ width: "100%", color: "pink" }}
        />
        <button
          onClick={sendMessage}
          style={{ width: "100%", marginTop: "5px", background: "pink", color: "black", border: "none", padding: "5px" }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChessGame;