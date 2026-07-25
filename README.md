# VIVA IASD

Primeiro protótipo funcional do aplicativo para adolescentes e pré-adolescentes da IASD.

## O que já está navegável

- Home com verso do dia, sequência de estudos e progresso semanal
- Estudo semanal com lição, Bíblia e livro
- Corrida de presença com trilha trimestral
- Quiz interativo
- Perfil com pontos, posição e conquistas
- Boas-vindas, criação de conta e login demonstrativo
- Escolha entre adolescente, diretor, coordenador e administrador
- Entrada do adolescente na turma por código de convite
- Mural, rankings, desafios mensais e flashcards
- Painel do diretor com conteúdo, quiz, avaliações e presença
- Painel distrital com aprovações, classes, encontros e relatórios
- Painel administrativo com distritos, igrejas, classes e coordenadores

Os dados e a autenticação desta versão são demonstrativos. A persistência das contas, aprovações e conteúdos será conectada ao Firebase nas próximas etapas.

## Preparação do Firebase

O SDK, o modelo de dados, a autenticação por e-mail, as regras de segurança e os índices do Firestore já estão preparados. O app continua em modo demonstrativo enquanto as credenciais não forem informadas.

1. Copie `.env.example` para `.env`.
2. No console do Firebase, crie um aplicativo Web dentro do projeto.
3. Preencha no `.env` os valores fornecidos pelo Firebase.
4. Ative **Authentication > E-mail/senha**, Firestore e Storage.

O arquivo `.env` é ignorado pelo Git e não será enviado ao GitHub.

## Testar o fluxo inicial

Use qualquer nome e e-mail. A senha precisa ter pelo menos 6 caracteres. Para testar o convite, informe qualquer código com 5 ou mais caracteres; o protótipo apresentará a turma demonstrativa **Base Geração**.

## Executar

```bash
npm install
npm start
```

Abra o projeto com o aplicativo Expo Go pelo QR code apresentado no terminal.
