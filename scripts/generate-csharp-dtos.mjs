#!/usr/bin/env node
/**
 * Generates C# DTOs from server/game/types.ts and matchmaking-types.ts for Unity.
 * Run from repo root: node scripts/generate-csharp-dtos.mjs
 *
 * Output: generated/csharp/TCG DTOs.cs
 * Copy or symlink into Unity project (e.g. Assets/Scripts/Network/ or Assets/Scripts/Generated/).
 *
 * Uses [Serializable] for Unity and [JsonProperty] for Newtonsoft.Json compatibility.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "generated", "csharp");
const outPath = join(outDir, "TCGDtos.cs");

const content = `// Auto-generated from server/game/types.ts and matchmaking-types.ts.
// Do not edit by hand. Run: node scripts/generate-csharp-dtos.mjs

using System;
using Newtonsoft.Json;

namespace TCG
{
    // ========== Game State DTOs (from types.ts) ==========

    [Serializable]
    public class TriggerEffect
    {
        [JsonProperty("type")] public string type;
        [JsonProperty("value")] public int value;
    }

    [Serializable]
    public class Trigger
    {
        [JsonProperty("event")] public string event_;
        [JsonProperty("effect")] public TriggerEffect effect;
    }

    [Serializable]
    public class SpellPersistentConfig
    {
        [JsonProperty("triggerPhase")] public string triggerPhase;
        [JsonProperty("duration")] public int duration;
        [JsonProperty("effect")] public PersistentEffectPayload effect;
    }

    [Serializable]
    public class PersistentEffectPayload
    {
        [JsonProperty("type")] public string type;
        [JsonProperty("damage")] public int damage;
        [JsonProperty("count")] public int count;
        [JsonProperty("amount")] public int amount;
    }

    [Serializable]
    public class CardTemplate
    {
        [JsonProperty("id")] public string id;
        [JsonProperty("name")] public string name;
        [JsonProperty("type")] public string type;
        [JsonProperty("cost")] public int cost;
        [JsonProperty("attack")] public int? attack;
        [JsonProperty("health")] public int? health;
        [JsonProperty("spellPower")] public int? spellPower;
        [JsonProperty("keywords")] public string[] keywords;
        [JsonProperty("flavorText")] public string flavorText;
        [JsonProperty("requiresTarget")] public bool? requiresTarget;
        [JsonProperty("spellEffect")] public string spellEffect;
        [JsonProperty("spellDraw")] public int? spellDraw;
        [JsonProperty("spellSummonPool")] public string[] spellSummonPool;
        [JsonProperty("triggers")] public Trigger[] triggers;
        [JsonProperty("spellPersistent")] public SpellPersistentConfig spellPersistent;
    }

    [Serializable]
    public class CardInstance
    {
        [JsonProperty("instanceId")] public string instanceId;
        [JsonProperty("cardId")] public string cardId;
        [JsonProperty("currentHealth")] public int? currentHealth;
        [JsonProperty("attackedThisTurn")] public bool? attackedThisTurn;
        [JsonProperty("attackBuff")] public int? attackBuff;
        [JsonProperty("healthBuff")] public int? healthBuff;
    }

    [Serializable]
    public class PlayerState
    {
        [JsonProperty("heroHealth")] public int heroHealth;
        [JsonProperty("hand")] public CardInstance[] hand;
        [JsonProperty("board")] public CardInstance[] board;
        [JsonProperty("deck")] public CardInstance[] deck;
    }

    [Serializable]
    public class PersistentEffect
    {
        [JsonProperty("id")] public string id;
        [JsonProperty("ownerIndex")] public int ownerIndex;
        [JsonProperty("triggerPhase")] public string triggerPhase;
        [JsonProperty("turnsRemaining")] public int turnsRemaining;
        [JsonProperty("effect")] public PersistentEffectPayload effect;
        [JsonProperty("sourceCardName")] public string sourceCardName;
    }

    [Serializable]
    public class GameState
    {
        [JsonProperty("currentTurn")] public int currentTurn;
        [JsonProperty("manaRemaining")] public int manaRemaining;
        [JsonProperty("players")] public PlayerState[] players;
        [JsonProperty("winner")] public int? winner;
        [JsonProperty("lastAction")] public string lastAction;
        [JsonProperty("error")] public string error;
        [JsonProperty("persistentEffects")] public PersistentEffect[] persistentEffects;
    }

    // ========== Client Intents (send to server) ==========

    [Serializable]
    public class PlayCreatureIntent
    {
        public string type = "play_creature";
        [JsonProperty("cardInstanceId")] public string cardInstanceId;
        [JsonProperty("boardIndex")] public int? boardIndex;
    }

    [Serializable]
    public class PlaySpellIntent
    {
        public string type = "play_spell";
        [JsonProperty("cardInstanceId")] public string cardInstanceId;
        [JsonProperty("targetId")] public string targetId;
    }

    [Serializable]
    public class AttackIntent
    {
        public string type = "attack";
        [JsonProperty("attackerInstanceId")] public string attackerInstanceId;
        [JsonProperty("targetId")] public string targetId;
    }

    [Serializable]
    public class EndTurnIntent
    {
        public string type = "end_turn";
    }

    // ========== Matchmaking Intents (send to server) ==========

    [Serializable]
    public class AuthenticateIntent
    {
        public string type = "authenticate";
        [JsonProperty("token")] public string token;
    }

    [Serializable]
    public class JoinQueueIntent
    {
        public string type = "join_queue";
    }

    [Serializable]
    public class LeaveQueueIntent
    {
        public string type = "leave_queue";
    }

    [Serializable]
    public class CreateLobbyIntent
    {
        public string type = "create_lobby";
    }

    [Serializable]
    public class JoinLobbyIntent
    {
        public string type = "join_lobby";
        [JsonProperty("code")] public string code;
    }

    [Serializable]
    public class LeaveLobbyIntent
    {
        public string type = "leave_lobby";
    }

    // ========== Server Messages (receive from server) ==========

    [Serializable]
    public class StateMessage
    {
        [JsonProperty("type")] public string type = "state";
        [JsonProperty("state")] public GameState state;
        [JsonProperty("playerIndex")] public int playerIndex;
        [JsonProperty("error")] public string error;
        [JsonProperty("opponentUsername")] public string opponentUsername;
    }

    [Serializable]
    public class ConnectedMessage
    {
        [JsonProperty("type")] public string type = "connected";
        [JsonProperty("sessionId")] public string sessionId;
        [JsonProperty("message")] public string message;
    }

    [Serializable]
    public class AuthenticatedMessage
    {
        [JsonProperty("type")] public string type = "authenticated";
        [JsonProperty("userId")] public string userId;
        [JsonProperty("username")] public string username;
    }

    [Serializable]
    public class AuthErrorMessage
    {
        [JsonProperty("type")] public string type = "auth_error";
        [JsonProperty("error")] public string error;
    }

    [Serializable]
    public class JoinedQueueMessage
    {
        [JsonProperty("type")] public string type = "joined_queue";
        [JsonProperty("message")] public string message;
    }

    [Serializable]
    public class LeftQueueMessage
    {
        [JsonProperty("type")] public string type = "left_queue";
    }

    [Serializable]
    public class LobbyCreatedMessage
    {
        [JsonProperty("type")] public string type = "lobby_created";
        [JsonProperty("code")] public string code;
        [JsonProperty("message")] public string message;
    }

    [Serializable]
    public class LobbyJoinedMessage
    {
        [JsonProperty("type")] public string type = "lobby_joined";
        [JsonProperty("code")] public string code;
        [JsonProperty("message")] public string message;
    }

    [Serializable]
    public class LobbyErrorMessage
    {
        [JsonProperty("type")] public string type = "lobby_error";
        [JsonProperty("error")] public string error;
    }

    [Serializable]
    public class MatchmakingErrorMessage
    {
        [JsonProperty("type")] public string type = "matchmaking_error";
        [JsonProperty("error")] public string error;
    }

    // ========== Card Catalog Response (GET /card-catalog) ==========

    [Serializable]
    public class CardCatalogResponse
    {
        [JsonProperty("cards")] public CardTemplate[] cards;
    }
}
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, content, "utf8");
console.log("Wrote", outPath);
console.log("Copy or symlink generated/csharp/TCGDtos.cs into your Unity project (e.g. Assets/Scripts/Generated/).");
