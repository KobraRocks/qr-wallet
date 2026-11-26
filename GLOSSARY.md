# QR Wallet

A phone-first wallet of scannable QR codes. Each card is presented on screen for another person to scan; the wallet lives entirely on the device.

## Language

**Wallet**:
The complete set of cards on one device.
_Avoid_: Account, collection, library, vault

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

**Display Name**:
The name a Card Face shows: derived from the Card's Payload when the Payload supplies one (a Visit Card's full name), otherwise the Card's label.
_Avoid_: Title, heading

**Card Face**:
The main view surface that presents the active Card: its Display Name, its kind, and its QR Panel.
_Avoid_: Card view, preview

**QR Panel**:
The light surface that displays the active Card's QR code.
_Avoid_: QR card, code card

**Card Menu**:
The vertical list of every Card in the Wallet, opened from the main view, that switches the displayed Card.
_Avoid_: Drawer, sidebar, tabs, Pills

**Pager**:
The top bar control that steps to the previous or next Card and shows the position in the Wallet.
_Avoid_: Arrows, carousel, swipe

**Dock**:
The floating row of actions for the active Card in the main view: Edit, Copy Payload, and Share.
_Avoid_: Toolbar, action bar

**Seed Cards**:
The three placeholder cards created on first launch only: Visit Card, Website, Sales Deck.
_Avoid_: Defaults, samples, examples

**Backup**:
A portable copy of the complete wallet, used to move cards to another device.
_Avoid_: Sync, cloud backup, vault

**Private Backup**:
The sheet, opened from the Card Menu footer, that exports and imports a Backup.
_Avoid_: Vault, cloud backup
