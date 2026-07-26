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

O backend em `functions/` também prepara correção segura de quizzes, pontuação de desafios, conquistas automáticas, relatórios por nível de acesso e arquivamento trimestral do hall da fama.

O aplicativo também oferece seleção de distrito e classe no cadastro de liderança, upload de PDFs e fotos pelo aparelho, relatórios em PDF e registro de notificações push. Para push em dispositivos reais, informe o `projectId` do EAS na configuração do Expo.

## Testes locais com Firebase Emulator

Com o Firebase CLI instalado, execute `firebase emulators:start` na raiz do projeto. Em outro terminal, execute `npm --prefix functions run seed`. A interface dos emuladores ficará em `http://localhost:4000` e a classe demonstrativa usará o código `VIVA-7429`.

## Builds do aplicativo

O `eas.json` contém perfis de desenvolvimento, teste interno e produção. Depois de executar `eas login` e `eas init`, use `npm run build:preview` para gerar um APK de teste. O `eas init` adicionará o `projectId` necessário para notificações push em aparelhos reais.

## Testar o fluxo inicial

Use qualquer nome e e-mail. A senha precisa ter pelo menos 6 caracteres. Para testar o convite, informe qualquer código com 5 ou mais caracteres; o protótipo apresentará a turma demonstrativa **Base Geração**.

## Executar

```bash
npm install
npm start
```

Abra o projeto com o aplicativo Expo Go pelo QR code apresentado no terminal.
