import ComponentFactory from "@/components/ComponentFactory";
import { AddToCartSlot } from "@/components/client/AddToCartSlot";

export default function Home() {

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-2xl mb-8">Home - Testing</h1>
        
        <ComponentFactory>
          <AddToCartSlot productId="123" price={123.99} initialStock={10} />
        </ComponentFactory>
        
      </main>
    </div>
  );
}
