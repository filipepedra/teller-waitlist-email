import SimulatorForm from "./SimulatorForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">teller-waitlist-email · simulador local</h1>
        <p className="mt-2 text-sm text-gray-600">
          Dispara o mesmo fluxo de prod: <code>append</code> na aba da waitlist no Google Sheet +
          envio do email de boas-vindas via Gmail SMTP. Dedupe por aba <code>email_sends</code>.
        </p>
      </header>
      <SimulatorForm />
    </main>
  );
}
