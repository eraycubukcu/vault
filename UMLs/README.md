# Vault Chat - UML Diyagramları

PlantUML kaynakları. Görüntülemek için VS Code "PlantUML" eklentisi veya:

```bash
java -jar plantuml.jar -charset UTF-8 -tpng UMLs/*.puml
```

| Dosya | Tür | İçerik |
|---|---|---|
| 01-use-case.puml | Use Case | Aktörler (Ziyaretçi, Kullanıcı, Moderatör, Admin) ve işlevler |
| 02-class-domain-model.puml | Class | Prisma veri modeli (Profile, Server, Member, Channel, Message, Conversation, DirectMessage) |
| 03-component-architecture.puml | Component | İstemci, Next.js API'leri, lib katmanı ve dış servisler |
| 04-deployment.puml | Deployment | Tarayıcı, Node.js sunucusu, MongoDB, Clerk, LiveKit, UploadThing |
| 05-package-structure.puml | Package | Klasör yapısı ve bağımlılıklar |
| 06-seq-auth-setup.puml | Sequence | Giriş ve ilk profil/sunucu yönlendirmesi |
| 07-seq-create-server.puml | Sequence | Sunucu oluşturma (görsel yükleme dahil) |
| 08-seq-invite-join.puml | Sequence | Davet kodu yenileme ve davetle katılma |
| 09-seq-send-message-realtime.puml | Sequence | Mesaj gönderme + Socket.IO ile gerçek zamanlı dağıtım |
| 10-seq-edit-delete-message.puml | Sequence | Mesaj düzenleme / silme |
| 11-seq-direct-message.puml | Sequence | Özel mesajlaşma (Conversation) |
| 12-seq-media-room.puml | Sequence | LiveKit ile sesli/görüntülü oda |
| 13-seq-member-management.puml | Sequence | Üye rolü değiştirme / atma |
| 14-activity-message-authorization.puml | Activity | Mesaj API'si yetkilendirme kontrolleri |
| 15-state-message.puml | State | Mesaj yaşam döngüsü (gönderildi → düzenlendi → silindi) |
| 16-state-modal-store.puml | State | `useModal` (zustand) modal durumu |
