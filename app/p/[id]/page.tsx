import { PlaceholderRenderer } from "@/components/client/PlaceholderRenderer";
import { PlaceholderProvider } from "@/packages/placeholder/components/PlaceholderProvider";
import { PlaceholderRendererServer } from "@/packages/placeholder/components/PlaceholderRendererServer";
import { placeholderRegistry } from "@/packages/ui/placeholder-registry";
import { serverFactory } from "@/packages/ui/server-factory";
import { Suspense } from "react";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

// No configure() at module scope — that would mutate the shared singleton
// once at build time and then fail on repeated prerender passes (duplicate
// id error) or bleed mutations across requests in production.

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  // branch() produces an isolated copy of the registry.
  // Mutations here do not affect placeholderRegistry or any other request.
  // Each prerender pass gets its own fresh branch from the same clean baseline.
  // const pageRegistry = placeholderRegistry.branch();

  // pageRegistry.configure("server:product:sidebar-top", [
  //   {
  //     op: "append",
  //     item: {
  //       kind: "component",
  //       id: "product-image",
  //       component: () =>
  //         import("@/packages/ui/server/ProductSummary/ProductSummaryServer"),
  //       props: {
  //         productId: "Static Prop 123",
  //       },
  //       visible: true,
  //     },
  //   },
  // ]);

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          <PlaceholderProvider
            registry={placeholderRegistry}
            serverFactory={serverFactory}
            ClientRenderer={PlaceholderRenderer}
            configure={{
              "server:product:sidebar-top": [
                {
                  op: "append",
                  item: {
                    kind: "component",
                    id: "product-summary",
                    component: () =>
                      import("@/packages/ui/server/ProductSummary/ProductSummaryServer"),
                    props: {
                      productId: "Static Prop 123",
                    },
                    visible: true,
                  },
                },
              ],
              "product:sidebar": [
                {
                  op: "append",
                  item: {
                    kind: "component",
                    id: "product-image",
                    component: () =>
                      import("@/packages/ui/server/ProductImage"),
                    props: {
                      image: {
                        url: "https://picsum.photos/seed/9/300/150",
                        width: 300,
                        height: 150,
                      },
                    },
                    visible: true,
                  },
                },
              ],
              "product:main": [
                {
                  op: "append",
                  item: {
                    kind: "slot",
                    id: "add-to-cart",
                    slotName: "add-to-cart",
                    props: {},
                    visible: true,
                  },
                },
                {
                  op: "replace",
                  id: "product-description",
                  item: {
                    kind: "component",
                    id: "product-description",
                    component: () =>
                      import("@/components/server/ProductDescription"),
                    props: {},
                    visible: true,
                  },
                },
              ],
            }}
            clientPlaceholders={["product:sidebar"]}
          >
            <main className="lg:col-span-7">
              <div className="space-y-8">
                <Suspense>
                  <PlaceholderRendererServer placeholderName="product:main" />
                </Suspense>
              </div>
            </main>
            <aside className="lg:col-span-3">
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
