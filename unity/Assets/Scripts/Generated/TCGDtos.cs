// Auto-generated from server/game/types.ts and matchmaking-types.ts.
// Do not edit by hand. Run: npm run generate:csharp from repo root, then copy from generated/csharp/

using System;
using Newtonsoft.Json;

namespace TCG
{
    [Serializable]
    public class TriggerEffect { [JsonProperty("type")] public string type; [JsonProperty("value")] public int value; }
    [Serializable]
    public class Trigger { [JsonProperty("event")] public string event_; [JsonProperty("effect")] public TriggerEffect effect; }
    [Serializable]
    public class SpellPersistentConfig { [JsonProperty("triggerPhase")] public string triggerPhase; [JsonProperty("duration")] public int duration; [JsonProperty("effect")] public PersistentEffectPayload effect; }
    [Serializable]
    public class PersistentEffectPayload { [JsonProperty("type")] public string type; [JsonProperty("damage")] public int damage; [JsonProperty("count")] public int count; [JsonProperty("amount")] public int amount; }
    [Serializable]
    public class CardTemplate { [JsonProperty("id")] public string id; [JsonProperty("name")] public string name; [JsonProperty("type")] public string type; [JsonProperty("cost")] public int cost; [JsonProperty("attack")] public int? attack; [JsonProperty("health")] public int? health; [JsonProperty("spellPower")] public int? spellPower; [JsonProperty("keywords")] public string[] keywords; [JsonProperty("flavorText")] public string flavorText; [JsonProperty("requiresTarget")] public bool? requiresTarget; [JsonProperty("spellEffect")] public string spellEffect; [JsonProperty("spellDraw")] public int? spellDraw; [JsonProperty("spellSummonPool")] public string[] spellSummonPool; [JsonProperty("triggers")] public Trigger[] triggers; [JsonProperty("spellPersistent")] public SpellPersistentConfig spellPersistent; }
    [Serializable]
    public class CardInstance { [JsonProperty("instanceId")] public string instanceId; [JsonProperty("cardId")] public string cardId; [JsonProperty("currentHealth")] public int? currentHealth; [JsonProperty("attackedThisTurn")] public bool? attackedThisTurn; [JsonProperty("attackBuff")] public int? attackBuff; [JsonProperty("healthBuff")] public int? healthBuff; }
    [Serializable]
    public class PlayerState { [JsonProperty("heroHealth")] public int heroHealth; [JsonProperty("hand")] public CardInstance[] hand; [JsonProperty("board")] public CardInstance[] board; [JsonProperty("deck")] public CardInstance[] deck; }
    [Serializable]
    public class PersistentEffect { [JsonProperty("id")] public string id; [JsonProperty("ownerIndex")] public int ownerIndex; [JsonProperty("triggerPhase")] public string triggerPhase; [JsonProperty("turnsRemaining")] public int turnsRemaining; [JsonProperty("effect")] public PersistentEffectPayload effect; [JsonProperty("sourceCardName")] public string sourceCardName; }
    [Serializable]
    public class GameState { [JsonProperty("currentTurn")] public int currentTurn; [JsonProperty("manaRemaining")] public int manaRemaining; [JsonProperty("players")] public PlayerState[] players; [JsonProperty("winner")] public int? winner; [JsonProperty("lastAction")] public string lastAction; [JsonProperty("error")] public string error; [JsonProperty("persistentEffects")] public PersistentEffect[] persistentEffects; }
    [Serializable]
    public class PlayCreatureIntent { public string type = "play_creature"; [JsonProperty("cardInstanceId")] public string cardInstanceId; [JsonProperty("boardIndex")] public int? boardIndex; }
    [Serializable]
    public class PlaySpellIntent { public string type = "play_spell"; [JsonProperty("cardInstanceId")] public string cardInstanceId; [JsonProperty("targetId")] public string targetId; }
    [Serializable]
    public class AttackIntent { public string type = "attack"; [JsonProperty("attackerInstanceId")] public string attackerInstanceId; [JsonProperty("targetId")] public string targetId; }
    [Serializable]
    public class EndTurnIntent { public string type = "end_turn"; }
    [Serializable]
    public class AuthenticateIntent { public string type = "authenticate"; [JsonProperty("token")] public string token; }
    [Serializable]
    public class JoinQueueIntent { public string type = "join_queue"; }
    [Serializable]
    public class LeaveQueueIntent { public string type = "leave_queue"; }
    [Serializable]
    public class CreateLobbyIntent { public string type = "create_lobby"; }
    [Serializable]
    public class JoinLobbyIntent { public string type = "join_lobby"; [JsonProperty("code")] public string code; }
    [Serializable]
    public class LeaveLobbyIntent { public string type = "leave_lobby"; }
    [Serializable]
    public class CardCatalogResponse { [JsonProperty("cards")] public CardTemplate[] cards; }
}

