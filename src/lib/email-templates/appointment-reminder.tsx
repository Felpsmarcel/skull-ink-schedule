import * as React from 'react'
import {
  Body,
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
  whenLabel?: string
  address?: string
  servicesSummary?: string
}

const Email = ({ clientName, artistName, whenLabel, address, servicesSummary }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Lembrete: seu agendamento é amanhã</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seu horário é amanhã</Heading>
        <Text style={text}>
          {clientName ? `Olá ${clientName},` : 'Olá,'} passando para lembrar do seu agendamento na
          GF Tattoo Academy.
        </Text>
        <Section style={box}>
          {whenLabel ? <Row label="Quando" value={whenLabel} /> : null}
          {artistName ? <Row label="Artista" value={artistName} /> : null}
          {servicesSummary ? <Row label="Serviço" value={servicesSummary} /> : null}
          {address ? <Row label="Endereço" value={address} /> : null}
        </Section>
        <Text style={text}>
          Chegue com <strong>15 minutos de antecedência</strong>, alimentado e hidratado.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Precisa remarcar? Responda este e-mail o quanto antes.
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
  subject: 'Lembrete: seu agendamento é amanhã',
  displayName: 'Lembrete 24h antes',
  previewData: {
    clientName: 'Maria',
    artistName: 'GF',
    whenLabel: 'sexta, 03/07/2026 às 14:00',
    address: 'GF Tattoo Academy, Bruxelas',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '8px', padding: '18px 20px', margin: '0 0 24px' }
const rowText = { fontSize: '14px', color: '#111111', margin: '4px 0', lineHeight: '1.5' }
const rowLabel = { color: '#777777' }
const hr = { borderColor: '#eeeeee', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', margin: 0 }

export default Email