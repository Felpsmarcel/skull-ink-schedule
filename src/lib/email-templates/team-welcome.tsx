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
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  artistName?: string
  agendaUrl?: string
  inviteUrl?: string
}

const Email = ({ artistName, agendaUrl, inviteUrl }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Bem-vindo à equipe GF Tattoo</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo(a) à equipe</Heading>
        <Text style={text}>
          {artistName ? `Olá ${artistName},` : 'Olá,'} sua conta na GF Tattoo Academy está pronta.
          Você já pode acessar sua agenda, ver seus próximos agendamentos e acompanhar as suas
          comissões.
        </Text>
        {inviteUrl ? (
          <>
            <Text style={text}>
              Para começar, defina sua senha de acesso clicando no botão abaixo. O link é
              pessoal e expira em algumas horas.
            </Text>
            <Button style={button} href={inviteUrl}>
              Definir minha senha
            </Button>
            <Text style={hintText}>
              Se o botão não abrir, copie e cole este endereço no navegador:
              <br />
              <span style={{ wordBreak: 'break-all' }}>{inviteUrl}</span>
            </Text>
          </>
        ) : agendaUrl ? (
          <Button style={button} href={agendaUrl}>
            Abrir agenda
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          {inviteUrl
            ? 'Se o link expirar, peça ao administrador do estúdio para reenviar o convite.'
            : 'Se precisar de ajuda para entrar, fale com o administrador do estúdio.'}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo(a) à equipe GF Tattoo',
  displayName: 'Boas-vindas equipe',
  previewData: { artistName: 'GF', inviteUrl: 'https://gftattoocalendar.com/auth/update-password?token_hash=preview&type=invite' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const hintText = { fontSize: '12px', color: '#666666', lineHeight: '1.5', margin: '16px 0 0' }
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