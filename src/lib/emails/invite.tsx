import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  inviterName: string
  orgName: string
  rol: string
  inviteUrl: string
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  pm: 'Project Manager',
  viewer: 'Visualizador',
}

export function InviteEmail({ inviterName, orgName, rol, inviteUrl }: InviteEmailProps) {
  const rolLabel = roleLabels[rol] ?? rol

  return (
    <Html lang="es">
      <Head />
      <Preview>
        {inviterName} te invita a unirte a {orgName} en Kivo
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo / marca */}
          <Section style={logoSection}>
            <Text style={logo}>Kivo</Text>
          </Section>

          <Heading style={heading}>Te invitaron a Kivo</Heading>

          <Text style={paragraph}>
            <strong>{inviterName}</strong> te ha invitado a unirte a{' '}
            <strong>{orgName}</strong> con el rol de{' '}
            <strong>{rolLabel}</strong>.
          </Text>

          <Text style={paragraph}>
            Kivo es la plataforma de gestión financiera para agencias creativas.
            Con tu cuenta podrás ver proyectos, presupuestos y el flujo de caja de tu organización.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={inviteUrl}>
              Activar mi cuenta
            </Button>
          </Section>

          <Text style={smallText}>
            Este enlace expira en 24 horas. Si no esperabas esta invitación,
            puedes ignorar este correo.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Kivo · Gestión financiera para agencias creativas
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Estilos inline (necesarios para clientes de email) ──────────────────────

const main: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '40px',
  borderRadius: '8px',
  maxWidth: '480px',
}

const logoSection: React.CSSProperties = {
  marginBottom: '24px',
}

const logo: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#18181b',
  margin: '0',
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#18181b',
  marginBottom: '16px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#3f3f46',
  marginBottom: '16px',
}

const buttonSection: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
}

const button: React.CSSProperties = {
  backgroundColor: '#18181b',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
}

const smallText: React.CSSProperties = {
  fontSize: '13px',
  color: '#71717a',
  lineHeight: '1.5',
}

const hr: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '24px 0 16px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#a1a1aa',
  textAlign: 'center',
}
