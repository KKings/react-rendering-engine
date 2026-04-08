import { PlaceholderRenderer } from "@/components/client/PlaceholderRenderer";
import {
  PlaceholderProvider,
  PlaceholderRendererServer,
} from "@repo/placeholder";
import { placeholderRegistry } from "@repo/ui/placeholder-registry";
import { serverFactory } from "@repo/ui/server-factory";
import { Suspense } from "react";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default async function ProductPage(props: ProductPageProps) {
  const { params } = props;
  const { id } = await params;
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
          <PlaceholderProvider
            registry={placeholderRegistry}
            serverFactory={serverFactory}
            ClientRenderer={PlaceholderRenderer}
            clientPlaceholders={["product:sidebar"]}
          >
            <main className="md:col-span-7 space-y-8">
              <h1 className="text-3xl font-bold">Brand-A - product:{id}</h1>
              <div className="space-y-8">
                <Suspense>
                  <PlaceholderRendererServer placeholderName="product:main" />
                </Suspense>
              </div>
            </main>
            <aside className="md:col-span-3">
              <div className="space-y-4">
                <Suspense
                  fallback={
                    <div className="h-18 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  }
                >
                  <PlaceholderRendererServer placeholderName="server:product:sidebar-top" />
                </Suspense>
                <Suspense>
                  <PlaceholderRendererServer placeholderName="product:sidebar" />
                </Suspense>
              </div>
            </aside>
          </PlaceholderProvider>
        </div>
      </main>
    </div>
  );
}
