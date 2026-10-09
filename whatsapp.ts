// import makeWASocket, {
//   DisconnectReason,
//   useMultiFileAuthState,
//   type GroupMetadata,
//   type WASocket,
// } from '@whiskeysockets/baileys';
// import path from 'node:path';
// import qrcode from 'qrcode-terminal';

// const WHATSAPP_GROUP_ADMIN_PHONE = '918052665978';
// let socket: WASocket | undefined;
// let connecting: Promise<WASocket> | undefined;

// async function getSocket(): Promise<WASocket> {
//   if (socket) return socket;
//   if (connecting) return connecting;

//   connecting = (async () => {
//     const { state, saveCreds } = await useMultiFileAuthState(path.resolve('.whatsapp-auth'));
//     const activeSocket = makeWASocket({ auth: state });
//     activeSocket.ev.on('creds.update', saveCreds);

//     return new Promise<WASocket>((resolve, reject) => {
//       activeSocket.ev.on('connection.update', (update) => {
//         if (update.qr) {
//           console.log('\nScan this QR code in WhatsApp > Linked devices:');
//           qrcode.generate(update.qr, { small: true });
//         }
//         if (update.connection === 'open') {
//           socket = activeSocket;
//           console.log('WhatsApp connected.');
//           resolve(activeSocket);
//         }
//         if (update.connection === 'close') {
//           socket = undefined;
//           const statusCode = update.lastDisconnect?.error
//             ? (update.lastDisconnect.error as Error & { output?: { statusCode?: number } }).output?.statusCode
//             : undefined;
//           reject(statusCode === DisconnectReason.loggedOut
//             ? new Error('WhatsApp logged out. Delete .whatsapp-auth and scan again.')
//             : new Error(`WhatsApp connection closed${statusCode ? ` (${statusCode})` : ''}.`));
//         }
//       });
//     });
//   })();

//   try {
//     return await connecting;
//   } finally {
//     connecting = undefined;
//   }
// }

// function normalizePhoneNumber(number: string | number): string {
//   return String(number).replace(/\D/g, '');
// }

// function toUserJid(number: string | number): string {
//   const phoneNumber = normalizePhoneNumber(number);
//   if (!phoneNumber) throw new TypeError('A valid phone number is required.');
//   return `${phoneNumber}@s.whatsapp.net`;
// }

// function validateMessage(body: string): void {
//   if (typeof body !== 'string' || !body.trim()) {
//     throw new TypeError('Message body must be a non-empty string.');
//   }
// }

// async function sendMessage(number: string | number, body: string): Promise<unknown> {
//   validateMessage(body);
//   return (await getSocket()).sendMessage(toUserJid(number), { text: body });
// }

// async function findGroupByName(groupName: string): Promise<GroupMetadata | null> {
//   const groups = await (await getSocket()).groupFetchAllParticipating();
//   return Object.values(groups).find((group) => group.subject === groupName) ?? null;
// }

// async function getOrCreateGroup(
//   groupName: string,
//   participants: (string | number)[] = [WHATSAPP_GROUP_ADMIN_PHONE],
// ): Promise<GroupMetadata> {
//   if (!groupName.trim()) throw new TypeError('Group name is required.');
//   const activeSocket = await getSocket();
//   let group = await findGroupByName(groupName);

//   if (!group) {
//     const participantJids = participants.map(toUserJid);
//     if (participantJids.length === 0) {
//       throw new Error('Cannot create a WhatsApp group without an initial participant.');
//     }
//     console.log(`Creating WhatsApp group: "${groupName}"`);
//     group = await activeSocket.groupCreate(groupName, participantJids);
//   }

//   const adminJid = toUserJid(WHATSAPP_GROUP_ADMIN_PHONE);
//   let metadata = await activeSocket.groupMetadata(group.id);
//   const isConfiguredAdmin = (participant: GroupMetadata['participants'][number]) =>
//     participant.id === adminJid || participant.phoneNumber === adminJid ||
//     normalizePhoneNumber(participant.phoneNumber ?? '') === WHATSAPP_GROUP_ADMIN_PHONE;
//   let admin = metadata.participants.find(isConfiguredAdmin);

//   if (!admin) {
//     const registered = (await activeSocket.onWhatsApp(WHATSAPP_GROUP_ADMIN_PHONE))
//       ?.find((entry) => entry.exists);
//     const participantJid = registered?.jid ?? adminJid;
//     await activeSocket.groupParticipantsUpdate(group.id, [participantJid], 'add');
//     metadata = await activeSocket.groupMetadata(group.id);
//     admin = metadata.participants.find(isConfiguredAdmin);
//   }
//   if (!admin) throw new Error(`Could not add ${WHATSAPP_GROUP_ADMIN_PHONE} to WhatsApp group "${groupName}".`);

//   if (!admin.admin) {
//     const results = await activeSocket.groupParticipantsUpdate(group.id, [admin.id], 'promote');
//     const result = results.find((item) => item.jid === admin.id);
//     if (result?.status !== '200') {
//       throw new Error(`Could not promote ${WHATSAPP_GROUP_ADMIN_PHONE} to admin in "${groupName}".`);
//     }
//     metadata = await activeSocket.groupMetadata(group.id);
//   }

//   console.log(`WhatsApp group ready: ${metadata.subject} (${metadata.id})`);
//   return metadata;
// }

// async function sendGroupMessage(groupJid: string, body: string): Promise<unknown> {
//   if (!groupJid.endsWith('@g.us')) throw new TypeError('A valid WhatsApp group JID is required.');
//   validateMessage(body);
//   return (await getSocket()).sendMessage(groupJid, { text: body });
// }

// async function sendMessageToGroup(
//   groupName: string,
//   body: string,
//   initialParticipants: (string | number)[] = [WHATSAPP_GROUP_ADMIN_PHONE],
// ): Promise<GroupMetadata> {
//   const group = await getOrCreateGroup(groupName, initialParticipants);
//   await sendGroupMessage(group.id, body);
//   console.log(`WhatsApp message sent to ${group.subject}.`);
//   return group;
// }

// async function closeWhatsApp(): Promise<void> {
//   if (!socket) return;
//   const activeSocket = socket;
//   socket = undefined;
//   await activeSocket.end(undefined);
// }

// export {
//   WHATSAPP_GROUP_ADMIN_PHONE,
//   sendMessage,
//   findGroupByName,
//   getOrCreateGroup,
//   sendGroupMessage,
//   sendMessageToGroup,
//   closeWhatsApp,
// };




import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type GroupMetadata,
  type WASocket,
} from '@whiskeysockets/baileys';

import path from 'node:path';
import qrcode from 'qrcode-terminal';

const WHATSAPP_GROUP_ADMIN_PHONE = '918052665978';
const AUTH_DIR = path.resolve('.whatsapp-auth');

let socket: WASocket | undefined;
let connecting: Promise<WASocket> | undefined;
let shuttingDown = false;

type DisconnectError = Error & {
  output?: { statusCode?: number };
};

function getStatusCode(error: unknown): number | undefined {
  return (error as DisconnectError | undefined)?.output?.statusCode;
}

async function createSocket(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const activeSocket = makeWASocket({
    auth: state,
    defaultQueryTimeoutMs: undefined,
  });

  activeSocket.ev.on('creds.update', () => {
    void saveCreds().catch((error: unknown) => {
      console.error('[WhatsApp] Failed to save credentials:', error);
    });
  });

  return new Promise<WASocket>((resolve, reject) => {
    let settled = false;
    let opened = false;

    activeSocket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(
          '\nScan this QR code in WhatsApp > Linked devices:',
        );
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        opened = true;
        settled = true;
        socket = activeSocket;

        console.log('[WhatsApp] Connected successfully.');
        resolve(activeSocket);
        return;
      }

      if (connection !== 'close') return;

      const error = lastDisconnect?.error;
      const statusCode = getStatusCode(error);

      console.error('[WhatsApp] Connection closed:', {
        message: error?.message,
        statusCode,
      });

      if (socket === activeSocket) {
        socket = undefined;
      }

      if (shuttingDown) {
        if (!settled) {
          settled = true;
          reject(new Error('WhatsApp connection closed.'));
        }
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        if (!settled) {
          settled = true;
          reject(
            new Error(
              'WhatsApp logged out. A new QR pairing is required.',
            ),
          );
        }
        return;
      }

      if (!opened && !settled) {
        settled = true;
        reject(
          error ?? new Error('WhatsApp connection closed before opening.'),
        );
        return;
      }

      // The existing socket closed after a successful connection.
      // Reuse the shared connection manager to avoid duplicate sockets.
      console.log('[WhatsApp] Reconnecting...');

      setTimeout(() => {
        if (!shuttingDown) {
          void getSocket().catch((reconnectError: unknown) => {
            console.error(
              '[WhatsApp] Reconnection failed:',
              reconnectError,
            );
          });
        }
      }, 1000);
    });
  });
}

async function getSocket(): Promise<WASocket> {
  if (shuttingDown) {
    throw new Error('WhatsApp is shutting down.');
  }

  if (socket) return socket;
  if (connecting) return connecting;

  const attempt = (async (): Promise<WASocket> => {
    while (!shuttingDown) {
      try {
        return await createSocket();
      } catch (error) {
        if (shuttingDown) throw error;

        const statusCode = getStatusCode(error);

        if (statusCode === DisconnectReason.loggedOut) {
          throw error;
        }

        console.error('[WhatsApp] Connection attempt failed:', {
          message: (error as Error)?.message,
          statusCode,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw new Error('WhatsApp connection cancelled.');
  })();

  connecting = attempt;

  try {
    return await attempt;
  } finally {
    if (connecting === attempt) {
      connecting = undefined;
    }
  }
}

function normalizePhoneNumber(number: string | number): string {
  return String(number).replace(/\D/g, '');
}

function toUserJid(number: string | number): string {
  const phoneNumber = normalizePhoneNumber(number);

  if (!phoneNumber) {
    throw new TypeError('A valid phone number is required.');
  }

  return `${phoneNumber}@s.whatsapp.net`;
}

function validateMessage(body: string): void {
  if (typeof body !== 'string' || !body.trim()) {
    throw new TypeError('Message body must be a non-empty string.');
  }
}

async function sendMessage(
  number: string | number,
  body: string,
): Promise<unknown> {
  validateMessage(body);

  return (await getSocket()).sendMessage(toUserJid(number), {
    text: body,
  });
}

async function findGroupByName(
  groupName: string,
): Promise<GroupMetadata | null> {
  const groups = await (await getSocket()).groupFetchAllParticipating();

  return (
    Object.values(groups).find((group) => group.subject === groupName) ?? null
  );
}

async function getOrCreateGroup(
  groupName: string,
  participants: (string | number)[] = [WHATSAPP_GROUP_ADMIN_PHONE],
): Promise<GroupMetadata> {
  if (!groupName.trim()) {
    throw new TypeError('Group name is required.');
  }

  const activeSocket = await getSocket();
  let group = await findGroupByName(groupName);

  if (!group) {
    const participantJids = [...new Set(participants.map(toUserJid))];

    if (participantJids.length === 0) {
      throw new Error(
        'Cannot create a WhatsApp group without an initial participant.',
      );
    }

    console.log(`[WhatsApp] Creating group: "${groupName}"`);

    group = await activeSocket.groupCreate(groupName, participantJids);
  }

  const adminJid = toUserJid(WHATSAPP_GROUP_ADMIN_PHONE);

  let metadata = await activeSocket.groupMetadata(group.id);

  const isConfiguredAdmin = (
    participant: GroupMetadata['participants'][number],
  ) =>
    participant.id === adminJid ||
    participant.phoneNumber === adminJid ||
    normalizePhoneNumber(participant.phoneNumber ?? '') ===
    WHATSAPP_GROUP_ADMIN_PHONE;

  let admin = metadata.participants.find(isConfiguredAdmin);

  if (!admin) {
    const registered = (
      await activeSocket.onWhatsApp(WHATSAPP_GROUP_ADMIN_PHONE)
    )?.find((entry) => entry.exists);

    if (!registered?.jid) {
      throw new Error(
        `WhatsApp account not found: ${WHATSAPP_GROUP_ADMIN_PHONE}`,
      );
    }

    await activeSocket.groupParticipantsUpdate(
      group.id,
      [registered.jid],
      'add',
    );

    metadata = await activeSocket.groupMetadata(group.id);
    admin = metadata.participants.find(isConfiguredAdmin);
  }

  if (!admin) {
    throw new Error(
      `Could not add ${WHATSAPP_GROUP_ADMIN_PHONE} to "${groupName}".`,
    );
  }

  if (!admin.admin) {
    const results = await activeSocket.groupParticipantsUpdate(
      group.id,
      [admin.id],
      'promote',
    );

    const result = results.find((item) => item.jid === admin.id);

    if (result?.status !== '200') {
      throw new Error(
        `Could not promote ${WHATSAPP_GROUP_ADMIN_PHONE} to admin in "${groupName}".`,
      );
    }

    metadata = await activeSocket.groupMetadata(group.id);
  }

  console.log(
    `[WhatsApp] Group ready: ${metadata.subject} (${metadata.id})`,
  );

  return metadata;
}

async function sendGroupMessage(
  groupJid: string,
  body: string,
): Promise<unknown> {
  if (!groupJid.endsWith('@g.us')) {
    throw new TypeError('A valid WhatsApp group JID is required.');
  }

  validateMessage(body);

  return (await getSocket()).sendMessage(groupJid, { text: body });
}

async function sendMessageToGroup(
  groupName: string,
  body: string,
  initialParticipants: (string | number)[] = [
    WHATSAPP_GROUP_ADMIN_PHONE,
  ],
): Promise<GroupMetadata> {
  const group = await getOrCreateGroup(groupName, initialParticipants);

  const result = await sendGroupMessage(group.id, body);

  console.log(`[WhatsApp] Send request completed for ${group.subject}.`);
  console.log('[WhatsApp] Send result:', result);
  return group;
}

async function closeWhatsApp(): Promise<void> {
  shuttingDown = true;

  const activeSocket = socket;
  socket = undefined;

  if (activeSocket) {
    await activeSocket.end(undefined);
  }
}

export {
  WHATSAPP_GROUP_ADMIN_PHONE,
  sendMessage,
  findGroupByName,
  getOrCreateGroup,
  sendGroupMessage,
  sendMessageToGroup,
  closeWhatsApp,
};