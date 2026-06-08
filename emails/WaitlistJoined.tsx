import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type WaitlistJoinedProps = {
  name?: string | null;
};

export const TEMPLATE_ID = "waitlist_joined_v1";
export const SUBJECT = "Você está na lista";

const styles = {
  body: {
    backgroundColor: "#FAFAFA",
    fontFamily: "Manrope, Inter, system-ui, sans-serif",
    color: "#0F172A",
    margin: "0",
    padding: "32px 0",
  },
  container: {
    maxWidth: "560px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #E6EAEF",
  },
  topBar: {
    backgroundColor: "#2563EB",
    height: "6px",
    lineHeight: "6px",
    fontSize: "1px",
  },
  logoSection: {
    padding: "28px 32px 20px",
    borderBottom: "1px solid #E6EAEF",
  },
  content: {
    padding: "32px 32px 8px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: "700",
    lineHeight: "28px",
    marginBottom: "20px",
    color: "#0F172A",
  },
  text: {
    fontSize: "16px",
    lineHeight: "26px",
    marginBottom: "16px",
    color: "#0F172A",
  },
  signoff: {
    fontSize: "16px",
    lineHeight: "26px",
    marginTop: "28px",
    marginBottom: "32px",
    color: "#0F172A",
  },
  footer: {
    backgroundColor: "#F2F4F7",
    borderTop: "1px solid #E6EAEF",
    padding: "16px 32px",
  },
  footerText: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "#6B6B6B",
    margin: "0",
  },
  footerLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
} as const;

export default function WaitlistJoined({ name }: WaitlistJoinedProps) {
  const greeting = name ? `Olá, ${name}!` : "Olá!";
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>A Teller tá chegando — e você vai ser um dos primeiros.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.topBar}>&nbsp;</Section>

          <Section style={styles.logoSection}>
            <Img
              src="https://useteller.com.br/assets/teller-app-icon.png"
              alt="Teller"
              width={48}
              height={48}
            />
          </Section>

          <Section style={styles.content}>
            <Heading style={styles.heading}>{greeting}</Heading>
            <Text style={styles.text}>
              Você tá dentro! Sua vaga na waitlist está reservada — quando o acesso abrir, você
              recebe um email aqui mesmo. Não precisa fazer nada.
            </Text>
            <Text style={styles.text}>
              Do outro lado, a gente tá construindo um agente de IA pra tirar o dinheiro da sua
              cabeça de vez. Sem planilha, sem pular de app em app, sem trabalho manual. Você vai
              ser um dos primeiros a ter acesso.
            </Text>
            <Text style={styles.text}>
              Qualquer dúvida ou curiosidade antes disso, é só responder este email. A gente lê
              tudo e responde.
            </Text>
            <Text style={styles.signoff}>
              Até breve,
              <br />
              Teller
            </Text>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © 2025 Teller ·{" "}
              <Link href="https://useteller.com.br" style={styles.footerLink}>
                useteller.com.br
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
