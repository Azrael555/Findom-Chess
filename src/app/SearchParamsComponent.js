"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const SearchParamsComponent = ({ setGameId }) => {
  const searchParams = useSearchParams();
  const gameIdFromUrl = searchParams.get("gameId");

  useEffect(() => {
    if (gameIdFromUrl) {
      setGameId(gameIdFromUrl); 
    }
  }, [gameIdFromUrl, setGameId]);

  return null; 
};

export default SearchParamsComponent;
