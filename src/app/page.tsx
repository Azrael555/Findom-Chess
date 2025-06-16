"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Chess } from "chess.js";
import { Suspense } from "react";
import { Chessboard } from "react-chessboard";
import Slideshow from "./slideshow";
import SearchParamsComponent from "./SearchParamsComponent";
import { useRouter } from "next/navigation";

const socket = io("https://a1ae826b-d039-40fd-814a-77154ddc0106-00-r13j153qke06.pike.replit.dev/");

const ChessGame = () => {
  const router = useRouter();
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [gameId, setGameId] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [username, setUsername] = useState("User");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [gameOver, setGameOver] = useState(null);
  const [kingInCheck, setKingInCheck] = useState(false);
  const [kingInCheckSquare, setKingInCheckSquare] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [fromSquare, setFromSquare] = useState(null); // For click-to-move
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // NEW: State for controlling slideshow visibility (only for white/Goddess)
  const [showSlideshows, setShowSlideshows] = useState(false);

  const leftImages = ["/left/1.jpg", "/left/2.jpg", "/left/3.jpg", "/left/4.jpg", "/left/5.jpg" ,"/left/6.jpg", "/left/7.jpg", "/left/8.jpg", "/left/9.jpg", "/left/10.jpg" 
                      "/left/1.gif", "/left/2.gif", "/left/3.gif", "/left/4.gif", "/left/5.gif" , "/left/6.gif", "/left/7.gif", "/left/8.gif", "/left/9.gif", "/left/10.gif" 
                     ];
  const rightImages = ["/right/1.jpg", "/right/2.jpg", "/right/3.jpg", "/right/4.jpg", "/right/5.jpg" ,"/right/6.jpg", "/right/7.jpg", "/right/8.jpg", "/right/9.jpg", "/right/10.jpg" 
                       "/right/1.gif", "/right/2.gif", "/right/3.gif", "/right/4.gif", "/right/5.gif" , "/right/6.gif", "/right/7.gif", "/right/8.gif", "/right/9.gif", "/right/10.gif" 
                      ];
  const [leftImageIndex, setLeftImageIndex] = useState(0);
  const [rightImageIndex, setRightImageIndex] = useState(0);

  const [audio, setAudio] = useState(null);
  const [checkAudio, setCheckAudio] = useState(null);

  // Initialize the audio
  useEffect(() => {
    const newAudio = new Audio("/audios/audio.mp3");
    newAudio.loop = true;
    newAudio.volume = 0.8;
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

  // Handle game initialization and joining
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const urlGameId = params.get("gameId");

  if (urlGameId) {
    setGameId(urlGameId);
    socket.emit("joinGame", urlGameId);
  } else {
    const newGameId = Math.random().toString(36).substring(2, 10);
    setGameId(newGameId);
    router.push(`/?gameId=${newGameId}`);
    socket.emit("joinGame", newGameId);
  }

    // Socket event listeners
    socket.on("playerColor", (color) => {
      setPlayerColor(color);
      setUsername(color === "w" ? "Goddess" : "Subject");
      // Show slideshow by default for black player, hide for white
      setShowSlideshows(color === "b");
    });

    socket.on("spectator", () => {
      setPlayerColor("spectator");
      setUsername(`Spectator ${Math.floor(Math.random() * 1000)}`);
      //  Show slideshows for spectators
      setShowSlideshows(true);
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

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    });

    return () => {
      socket.off("gameState");
      socket.off("playerColor");
      socket.off("spectator");
      socket.off("gameOver");
      socket.off("chatMessage");
      socket.off("typing");
    };
  }, []);

  // Slideshow interval
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

      const kingInCheckColor = chess.turn(); // The player whose turn it is now is in check
      const opponentColor = kingInCheckColor === "w" ? "b" : "w"; // The player who gave check

      console.log("🔍 King in check color:", kingInCheckColor);
      console.log("🎭 Player color:", playerColor);

        // Play check sound for BOTH players
        if (playerColor === kingInCheckColor || playerColor === opponentColor) {  
            console.log(`🔊 Playing check sound for ${playerColor.toUpperCase()}!`);
            checkAudio?.play()
            .then(() => console.log("✅ Audio played successfully!"))
            .catch((error) => console.error("❌ Audio playback failed:", error));
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

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  const handleSquareClick = (square) => {
    const piece = chess.get(square);

    if (fromSquare === null) {
      if (piece && piece.color === playerColor) {
        setFromSquare(square);
      }
    } else {
      if (square === fromSquare) {
        setFromSquare(null);
      } else if (piece && piece.color === playerColor) {
        setFromSquare(square);
      } else {
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

  // NEW: Function to toggle slideshow visibility
  const toggleSlideshows = () => {
    setShowSlideshows(!showSlideshows);
  };

  // NEW: Determine if slideshows should be rendered
  const shouldShowSlideshows = () => {
    // Always show for black player and spectators
    if (playerColor === "b" || playerColor === "spectator") return true;
    // For white player (Goddess), only show if toggle is enabled
    if (playerColor === "w") return showSlideshows;
    return false;
  };

  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        height: "100vh", 
        justifyContent: "center",
        // NEW: Conditional background based on slideshow visibility
        backgroundColor: shouldShowSlideshows() ? "transparent" : "#2a2a2a"
      }}
    >
      <Suspense fallback={<p>Loading game...</p>}>
        <SearchParamsComponent setGameId={setGameId} />
      </Suspense>
      <div style={{ position: "absolute", top: "10px", textAlign: "center" }}>
        <h2>Online Chess Game</h2>
        <p style={getPlayerColorStyle()}>Game ID: {gameId}</p>
        <p style={getPlayerColorStyle()}>
          You are: {playerColor === "spectator" ? username : playerColor === "w" ? "Goddess" : "Subject"}
        </p>
        
        {/* NEW: Toggle button for white player only */}
        {playerColor === "w" && (
          <button
            onClick={toggleSlideshows}
            style={{
              padding: "8px 16px",
              backgroundColor: showSlideshows ? "#ff6b6b" : "#4ecdc4",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "10px",
              fontSize: "12px",
              fontWeight: "bold"
            }}
          >
            {showSlideshows ? "Hide" : "Show"}
          </button>
        )}
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
          
          {/* NEW: Conditionally render slideshows */}
          {shouldShowSlideshows() && (
            <>
              {/* Left Slideshow */}
              <Slideshow
                images={leftImages}
                position={{ top: "0%", left: "0%" }}
                size={{ width: "25vh", height: "37.5vh" }}
                opacityLevels={{ visible: 0.45, hidden: 0 }}
                fadeDuration={1.5}
                blankDuration={10.5}
              />

              <Slideshow
                images={leftImages}
                position={{ top: "20%", left: "17.5%" }}
                size={{ width: "40vh", height: "60vh" }}
                opacityLevels={{ visible: 0.55, hidden: 0 }}
                fadeDuration={1}
                blankDuration={9.5}
              />

              <Slideshow
                images={leftImages}
                position={{ top: "64%", left: "0%" }}
                size={{ width: "24vh", height: "36vh" }}
                opacityLevels={{ visible: 0.7, hidden: 0 }}
                fadeDuration={1.75}
                blankDuration={8}
              />

              <Slideshow
                images={leftImages}
                position={{ top: "18.25%", left: "6.25%" }}
                size={{ width: "42.5vh", height: "63.75vh" }}
                opacityLevels={{ visible: 0.9, hidden: 0 }}
                fadeDuration={1.8}
                blankDuration={5}
              />

              <Slideshow
               images={leftImages}
               position={{ top: "78%", left: "30.25%" }}
               size={{ width: "15vh", height: "22.5vh" }}
               opacityLevels={{ visible: 0.5, hidden: 0 }}
               fadeDuration={1.8}
               blankDuration={5}
              />

              <Slideshow
               images={leftImages}
               position={{ top: "3%", left: "30.75%" }}
               size={{ width: "15vh", height: "22.5vh" }}
               opacityLevels={{ visible: 0.5, hidden: 0 }}
               fadeDuration={1.8}
               blankDuration={5}
              />

              {/* Right Slideshow */}
              <Slideshow
                images={rightImages}
                position={{ top: "0%", left: "86%" }}
                size={{ width: "28vh", height: "42vh" }}
                opacityLevels={{ visible: 0.45, hidden: 0 }}
                fadeDuration={1.43}
                blankDuration={8.2}
              />

              <Slideshow
                images={rightImages}
                position={{ top: "15%", left: "62%" }}
                size={{ width: "33vh", height: "49.5vh" }}
                opacityLevels={{ visible: 0.5, hidden: 0 }}
                fadeDuration={1.15}
                blankDuration={7.25}
              />

              <Slideshow
                images={rightImages}
                position={{ top: "63%", left: "80%" }}
                size={{ width: "20vh", height: "30vh" }}
                opacityLevels={{ visible: 0.4, hidden: 0 }}
                fadeDuration={1.75}
                blankDuration={11}
              />

              <Slideshow
                images={rightImages}
                position={{ top: "18.25%", left: "68%" }}
                size={{ width: "42.5vh", height: "63.75vh" }}
                opacityLevels={{ visible: 0.92, hidden: 0 }}
                fadeDuration={1.75}
                blankDuration={5.3}
              />

              <Slideshow
               images={rightImages}
               position={{ top: "2.85%", left: "58.25%" }}
               size={{ width: "14vh", height: "21vh" }}
               opacityLevels={{ visible: 0.5, hidden: 0 }}
               fadeDuration={1.3}
               blankDuration={9.7}
              />

              <Slideshow
               images={rightImages}
               position={{ top: "77%", left: "58.25%" }}
               size={{ width: "14vh", height: "21vh" }}
               opacityLevels={{ visible: 0.57, hidden: 0 }}
               fadeDuration={1.33}
               blankDuration={9.3}
              />
            </>
          )}

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
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
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