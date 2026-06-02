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
export const SUBJECT = "Você entrou na waitlist da Teller";

const styles = {
  body: { backgroundColor: "#ffffff", fontFamily: "system-ui, sans-serif", color: "#111" },
  container: { padding: "32px 24px", maxWidth: "560px" },
  heading: { fontSize: "20px", lineHeight: "28px", marginBottom: "16px" },
  text: { fontSize: "16px", lineHeight: "24px", marginBottom: "16px" },
  signoff: { fontSize: "16px", lineHeight: "24px", marginTop: "32px" },
} as const;

export default function WaitlistJoined({ name }: WaitlistJoinedProps) {
  const greeting = name ? `Olá, ${name},` : "Olá,";
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Sua inscrição na waitlist da Teller foi recebida.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{greeting}</Heading>
          <Text style={styles.text}>
            Recebemos sua inscrição na waitlist da Teller — obrigado por se juntar.
          </Text>
          <Text style={styles.text}>
            A Teller é um agente de IA pensado pra te ajudar a organizar sua vida financeira no dia
            a dia. Sem planilha, sem mais um app virando problema.
          </Text>
          <Text style={styles.text}>
            Vamos te avisar por aqui assim que houver novidades ou convite de acesso.
          </Text>
          <Text style={styles.signoff}>
            Até logo,
            <br />
            Equipe Teller
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
