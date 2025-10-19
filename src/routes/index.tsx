import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="relative max-w-5xl mx-auto">
          <p className="text-2xl md:text-3xl text-gray-300 mb-4 font-light">The framework for next generation AI applications</p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
            Full-stack framework powered by TanStack Router for React and Solid. Build modern applications with server functions, streaming, and type
            safety.
          </p>
        </div>
      </section>

      <section className="py-16 px-6 max-w-7xl mx-auto"></section>
    </div>
  );
}
