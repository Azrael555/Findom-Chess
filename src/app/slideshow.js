"use client";

import { useEffect, useState } from "react";

const Slideshow = ({ images, position, size, opacityLevels, fadeDuration, blankDuration }) => {
  if (!Array.isArray(images) || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showImage, setShowImage] = useState(true);

  useEffect(() => {
    const cycleImages = () => {
      setShowImage(false); // Hide image first
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setShowImage(true); // Show next image
      }, blankDuration * 1000); // Wait before switching images
    };

    const interval = setInterval(cycleImages, parseFloat(fadeDuration) * 1000 * 2 + blankDuration * 1000);

    return () => clearInterval(interval);
  }, [images.length, fadeDuration, blankDuration]);

  return (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: size.width,
        height: size.height,
        overflow: "hidden",
        borderRadius: "10px",
      }}
    >
      {images.map((img, index) => (
        <img
          key={index}
          src={img}
          alt="Slideshow"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: `opacity ${fadeDuration}s ease-in-out`,
            opacity: currentIndex === index && showImage ? opacityLevels.visible : opacityLevels.hidden,
          }}
        />
      ))}
    </div>
  );
};

export default Slideshow;
