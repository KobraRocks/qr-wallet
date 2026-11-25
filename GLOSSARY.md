# QR Wallet

A phone-first wallet of scannable QR codes. Each card is presented on screen for another person to scan; the wallet lives entirely on the device.

## Language

**Wallet**:
The complete set of cards on one device.
_Avoid_: Account, collection, library

**Card**:
A saved wallet entry: a label, one card kind, and the source of one payload.
_Avoid_: Item, tab, QR code

**Card Kind**:
The payload format a card carries: Visit Card (a vCard 3.0 contact), Link (a URL), or Text (plain text).
_Avoid_: Type, category

**Visit Card**:
A contact card whose payload is a vCard 3.0 document; also the default label of the first seed card.
_Avoid_: Business card, contact card

**Link**:
A card whose payload is a normalized URL.
_Avoid_: Website card, URL card

**Text**:
A card whose payload is plain text.
_Avoid_: Note card, custom card

**Payload**:
The exact string a card's QR code encodes.
_Avoid_: Data, content, value

**vCard**:
The vCard 3.0 interchange format used for Visit Card payloads.
_Avoid_: Contact file, VCF

**QR Panel**:
The white, black-on-white surface that displays the active card's QR code.
_Avoid_: QR card, code card

**Pill**:
A control in the horizontal selector that switches the displayed card.
_Avoid_: Tab, chip

**Seed Cards**:
The three placeholder cards created on first launch only: Visit Card, Website, Sales Deck.
_Avoid_: Defaults, samples, examples

**Backup**:
A portable copy of the complete wallet, used to move cards to another device.
_Avoid_: Sync, cloud backup
