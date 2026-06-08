import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type WaitlistJoinedProps = {
  name?: string | null;
};

export const TEMPLATE_ID = "waitlist_joined_v1";
export const SUBJECT = "Você está na lista";

const styles = {
  body: { backgroundColor: "#ffffff", fontFamily: "system-ui, sans-serif", color: "#111" },
  container: { padding: "32px 24px", maxWidth: "560px" },
  heading: { fontSize: "20px", lineHeight: "28px", marginBottom: "16px" },
  text: { fontSize: "16px", lineHeight: "24px", marginBottom: "16px" },
  signoff: { fontSize: "16px", lineHeight: "24px", marginTop: "32px" },
} as const;

export default function WaitlistJoined({ name }: WaitlistJoinedProps) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>A Teller tá chegando — e você vai ser um dos primeiros.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{greeting}</Heading>
          <Text style={styles.text}>
            Você tá dentro! Sua vaga na waitlist está reservada — quando o acesso abrir, você
            recebe um email aqui mesmo. Não precisa fazer nada.
          </Text>
          <Text style={styles.text}>
            Do outro lado, a gente tá construindo um agente de IA pra tirar o dinheiro da sua
            cabeça de vez. Sem planilha, sem pular de app em app, sem trabalho manual. Você vai ser
            um dos primeiros a ter acesso.
          </Text>
          <Text style={styles.text}>
            Qualquer dúvida ou curiosidade antes disso, é só responder este email. A gente lê tudo e responde.
          </Text>
          <Text style={styles.signoff}>
            Até breve,
            <br />
            Teller
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
