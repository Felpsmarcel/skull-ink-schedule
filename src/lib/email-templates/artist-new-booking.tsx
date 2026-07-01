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
  artistName?: string
  clientName?: string
  clientPhone?: string
  servicesSummary?: string
  whenLabel?: string
  commissionLabel?: string
  notes?: string
  agendaUrl?: string
}

const Email = ({
  artistName,
  clientName,
  clientPhone,
  servicesSummary,
  whenLabel,
  commissionLabel,
  notes,
  agendaUrl,
}: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Novo agendamento na sua agenda</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Novo agendamento</Heading>
        <Text style={text}>
          {artistName ? `Olá ${artistName},` : 'Olá,'} um novo cliente está na sua agenda.
        </Text>
        <Section style={box}>
          {whenLabel ? <Row label="Quando" value={whenLabel} /> : null}
          {clientName ? <Row label="Cliente" value={clientName} /> : null}
          {clientPhone ? <Row label="Telefone" value={clientPhone} /> : null}
          {servicesSummary ? <Row label="Serviço" value={servicesSummary} /> : null}
          {commissionLabel ? <Row label="Sua comissão" value={commissionLabel} /> : null}
          {notes ? <Row label="Notas" value={notes} /> : null}
        </Section>
        {agendaUrl ? (
          <Button style={button} href={agendaUrl}>
            Abrir agenda
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>GF Tattoo Academy — notificação interna.</Text>
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
  subject: 'Novo agendamento na sua agenda',
  displayName: 'Notificação para o artista',
  previewData: {
    artistName: 'GF',
    clientName: 'Maria',
    clientPhone: '+32 470 00 00 00',
    servicesSummary: 'Tatuagem média',
    whenLabel: 'sexta, 03/07/2026 às 14:00',
    commissionLabel: '€ 100,00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '8px', padding: '18px 20px', margin: '0 0 24px' }
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