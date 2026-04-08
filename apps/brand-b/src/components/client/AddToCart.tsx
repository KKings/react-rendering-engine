"use client";

import { useState } from "react";

export interface AddToCartProps {
  productId: string;
  price: number;
  initialStock: number;
}

export default function AddToCart({ productId, price, initialStock }: AddToCartProps) {
  const [stock, setStock] = useState(initialStock);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAddToCart() {
    if (stock === 0 || loading) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setAdded(true);
    setStock((s) => s - 1);
    setLoading(false);
    setTimeout(() => setAdded(false), 2000);
  }

  // Dynamic button classes
  const buttonBase =
    "py-3 px-6 rounded-lg font-semibold text-[15px] transition-colors border-none";
  const buttonAdded = "bg-[#3ddc84] text-[#0a1a0a]";
  const buttonOutOfStock = "bg-[#2a2a4a] text-white cursor-not-allowed";
  const buttonDefault = "bg-blue-700 text-white cursor-pointer";
  const buttonClass =
    buttonBase +
    " " +
    (added
      ? buttonAdded
      : stock === 0
      ? buttonOutOfStock
      : buttonDefault);

  // Dynamic stock text classes
  const stockClass =
    "text-xs " + (stock < 5 ? "text-[#ffb347]" : "text-[#7070a0]");

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleAddToCart}
        disabled={stock === 0 || loading}
        className={buttonClass}
      >
        {loading
          ? `Adding ${productId}`
          : added
          ? "✓ Added to cart"
          : `Custom Add to cart`}
      </button>
      <span className={stockClass}>
        {stock === 0 ? "Out of stock" : `${stock} left in stock`}
      </span>
    </div>
  );
}