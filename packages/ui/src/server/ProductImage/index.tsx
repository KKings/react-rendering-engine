import Image from "next/image";
import type { ProductImageProps, ProductImage } from "./types";

const defaultImage: ProductImage = {
  url: 'https://picsum.photos/seed/1/800/400',
  width: 800,
  height: 400,
}

export default async function ProductImage({ image }: ProductImageProps) {
  const imageData = image ?? defaultImage;
  return (
    <Image
      src={imageData.url}
      alt="Product placeholder"
      width={imageData.width}
      height={imageData.height}
      loading="eager"
      className="aspect-2/1 w-full h-auto rounded-xl shadow-md object-cover"
    />
  );
}
