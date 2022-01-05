FROM projectserum/build:v0.19.0

COPY . /workdir

RUN solana-keygen new --no-bip39-passphrase

RUN cd /workdir && anchor build
RUN npm run test:swap