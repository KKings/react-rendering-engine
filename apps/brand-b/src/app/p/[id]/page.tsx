import { PlaceholderRenderer } from "@/components/client/PlaceholderRenderer";
import { PlaceholderProvider, PlaceholderRendererServer } from "@repo/placeholder";
import { placeholderRegistry } from "@repo/ui/placeholder-registry";
import { serverFactory } from "@repo/ui/server-factory";
import { Suspense } from "react";
import { createPlaceholderConfiguration } from "./placeholders";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default async function ProductPage(props: ProductPageProps) {
  const { params } = props;
  const { id } = await params;
  const branch = serverFactory.branch();

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
          <PlaceholderProvider
            registry={placeholderRegistry}
            serverFactory={branch}
            ClientRenderer={PlaceholderRenderer}
            configure={createPlaceholderConfiguration(id)}
            clientPlaceholders={["product:sidebar"]}
          >
            <main className="md:col-span-7 space-y-8">
              <h1 className="text-3xl font-bold">Brand-B - product:{id}</h1>
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

      {/*
        ComponentFactory is a "use client" module.
        The () => import("./AddToCart") thunk inside it is a genuine lazy
        split point — Turbopack will NOT bundle it alongside the default.
        Only one of default or override will be in the JS bundle.
      */}
      {/* <ComponentFactory>
        <PlaceholderRendererServer placeholderName="product:sidebar" />
      </ComponentFactory> */}
    </div>
  );
}
