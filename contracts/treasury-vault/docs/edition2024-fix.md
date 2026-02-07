# Решение проблемы edition2024 с Anchor 0.31.1

## Проблема

При сборке проекта Anchor 0.31.1 с Solana platform-tools v1.51 (rustc 1.84.1, cargo 1.84.0) возникает ошибка:

```
error: failed to download `blake3 v1.8.3`
feature `edition2024` is required
The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.84.0)
```

Аналогичная ошибка может возникнуть для других пакетов:
- `constant_time_eq v0.4.2`
- `base64ct v1.8.0`

## Причина

1. **blake3 1.8.3** требует edition2024 и тянет **constant_time_eq 0.4.2**
2. **Solana platform-tools v1.51** поставляется с **cargo 1.84.0**, который не поддерживает edition2024
3. edition2024 стабилизирована только в cargo 1.85.0+

## Решение

### Вариант 1: Автоматический скрипт (рекомендуется)

```bash
./fix-edition2024.sh
```

### Вариант 2: Ручные команды

```bash
# 1. Удалить старый Cargo.lock
rm Cargo.lock

# 2. Создать новый Cargo.lock
cargo generate-lockfile

# 3. Downgrade blake3 до 1.8.2 (автоматически downgrade constant_time_eq до 0.3.1)
cargo update -p blake3 --precise 1.8.2
```

### Вариант 3: Добавить в Cargo.toml workspace dependencies

```toml
[workspace.dependencies]
blake3 = "=1.8.2"
```

Затем выполнить команды из варианта 2.

## Важно

❌ **НЕ используйте `[patch.crates-io]`** для downgrade версий из crates.io:

```toml
# ❌ Это НЕ работает!
[patch.crates-io]
blake3 = "=1.8.2"
```

**Причина:** Cargo не позволяет patch указывать на тот же источник (crates.io). Patch работает только для замены источника (например, на git или локальный путь).

## Проверка решения

```bash
# Проверить версии зависимостей
cargo tree -p blake3 -p constant_time_eq | grep -E "^(blake3|constant_time_eq)"

# Должно вывести:
# blake3 v1.8.2
# constant_time_eq v0.3.1
```

## Альтернативные решения

### Обновить Solana/Anchor (когда станет доступно)

Следить за обновлениями:
- [Anchor Releases](https://github.com/solana-foundation/anchor/releases)
- [Agave Issue #8443](https://github.com/anza-xyz/agave/issues/8443)
- [Solana SDK Issue #385](https://github.com/anza-xyz/solana-sdk/issues/385)

### Использовать nightly cargo (не рекомендуется для продакшена)

```bash
RUSTUP_TOOLCHAIN=nightly cargo build-sbf
```

## Ссылки

- [Agave Issue #8443: cargo-build-sbf fails with edition2024](https://github.com/anza-xyz/agave/issues/8443)
- [Solana SDK Issue #385: solana-program 3.0.0 edition2024](https://github.com/anza-xyz/solana-sdk/issues/385)
- [Cargo Overriding Dependencies](https://doc.rust-lang.org/cargo/reference/overriding-dependencies.html)
- [Twitter: InspirationGx solution](https://x.com/inspiration_gx/status/2018437360707314017)

## Статус

✅ **Решение проверено и работает** (2026-02-08)

- Anchor: 0.31.1
- Solana CLI: 3.0.15 (Agave)
- Platform-tools: v1.51 (rustc 1.84.1, cargo 1.84.0)
