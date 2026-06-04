"use client";

import { useState } from "react";

import { simulateWaitlistJoin, type SimulateResult } from "./actions/simulate";

export default function SimulatorForm() {
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setResult(null);
    const res = await simulateWaitlistJoin(formData);
    setResult(res);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="voce@exemplo.com"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Fulano"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Disparando..." : "Simular cadastro"}
        </button>
      </form>

      {result && (
        <pre
          className={`overflow-x-auto rounded-md p-4 text-xs ${
            result.ok
              ? "border border-green-200 bg-green-50 text-green-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
