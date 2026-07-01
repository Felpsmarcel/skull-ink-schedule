import * as React from 'react'
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
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  artistName?: string
  servicesSummary?: string
  whenLabel?: string
  totalLabel?: string
  address?: string
  siteName?: string
  siteUrl?: string
  agendaUrl?: string
}

const Email = ({
  clientName,
  artistName,
  servicesSummary,
  whenLabel,
  totalLabel,
  address,
  siteName = 'GF Tattoo Academy',
  agendaUrl,
}: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Seu agendamento em {siteName} está confirmado</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Agendamento confirmado</Heading>
        <Text style={text}>
          {clientName ? `Olá ${clientName},` : 'Olá,'} seu horário na{' '}
          <strong>{siteName}</strong> está reservado.
        </Text>
        <Section style={box}>
          {whenLabel ? <Row label="Quando" value={whenLabel} /> : null}
          {artistName ? <Row label="Artista" value={artistName} /> : null}
          {servicesSummary ? <Row label="Serviço" value={servicesSummary} /> : null}
          {totalLabel ? <Row label="Total" value={totalLabel} /> : null}
          {address ? <Row label="Endereço" value={address} /> : null}
        </Section>
        {agendaUrl ? (
          <Button style={button} href={agendaUrl}>
            Ver detalhes
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          Precisa remarcar? Responda este e-mail com pelo menos 24h de antecedência.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}>
    <span style={rowLabel}>{label}: </span>
    <strong>{value}</strong>
  </Text>
)

export const template = {
  component: Email,
  subject: 'Seu agendamento está confirmado',
  displayName: 'Confirmação de agendamento (cliente)',
  previewData: {
    clientName: 'Maria',
    artistName: 'GF',
    servicesSummary: 'Tatuagem média',
    whenLabel: 'sexta, 03/07/2026 às 14:00',
    totalLabel: '€ 250,00',
    address: 'GF Tattoo Academy, Bruxelas',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
  letterSpacing: '-0.01em',
}
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const box = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '18px 20px',
  margin: '0 0 24px',
}
const rowText = { fontSize: '14px', color: '#111111', margin: '4px 0', lineHeight: '1.5' }
const rowLabel = { color: '#777777' }
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eeeeee', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', margin: 0 }

export default Email