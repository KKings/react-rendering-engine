import ComponentFactory from "@/components/client/ComponentFactory";
import { AddToCartSlot } from "@/components/client/AddToCartSlot";
import Link from "next/link";

export default function Home() {

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start space-y-8">
        <h1 className="text-2xl">Home - Testing</h1>
        <h2 className="text-lg">Example using a ComponentFactory with a slot and no placeholders.</h2>
        <ComponentFactory>
          <p className="mb-4">Slot: add-to-cart</p>
          <div className="border border-red-500 p-4">
            <AddToCartSlot productId="123" price={123.99} initialStock={10} />
          </div>
        </ComponentFactory>
        <hr />
        <h2 className="text-lg">Example pages using default placeholders from a shared library (no overrides)</h2>
        <ul className="flex flex-col gap-4">
          <li><Link href="/p/1" className="text-blue-700 font-bold hover:underline cursor-pointer">Product 1</Link></li>
          <li><Link href="/p/2" className="text-blue-700 font-bold hover:underline cursor-pointer">Product 2</Link></li>
        </ul>
      </main>
    </div>
  );
}
