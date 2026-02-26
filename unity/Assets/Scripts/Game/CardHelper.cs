// Card helper - spell descriptions, effective stats (mirrors web logic).

using TCG;

namespace TCG.Game
{
    public static class CardHelper
    {
        public static bool SpellRequiresTarget(CardTemplate t)
        {
            if (t == null) return false;
            if (t.requiresTarget == false) return false;
            var eff = t.spellEffect;
            if (eff == "draw" || eff == "summon_random" || eff == "create_persistent") return false;
            return t.spellPower != null;
        }

        public static int EffectiveAttack(CardTemplate t, CardInstance c)
        {
            if (t == null) return 0;
            return (t.attack ?? 0) + (c?.attackBuff ?? 0);
        }

        public static int EffectiveMaxHealth(CardTemplate t, CardInstance c)
        {
            if (t == null) return 0;
            return (t.health ?? 0) + (c?.healthBuff ?? 0);
        }

        public static int CurrentHealth(CardInstance c, CardTemplate t)
        {
            if (c == null) return t?.health ?? 0;
            return c.currentHealth ?? t?.health ?? 0;
        }

        public static string SpellDescription(CardTemplate t)
        {
            if (t == null) return "Spell";
            if (t.spellEffect == "draw") return "Draw " + (t.spellDraw ?? 2);
            if (t.spellEffect == "summon_random") return "Summon random minion";
            if (t.spellEffect == "create_persistent" && t.spellPersistent != null)
            {
                var p = t.spellPersistent;
                var dmg = p.effect?.damage ?? 0;
                var desc = p.effect?.type == "deal_damage_all_enemy_minions" ? "Deal " + dmg + " to all enemy minions" : "Effect";
                return desc + " (" + p.duration + " turns)";
            }
            if (t.spellPower != null) return "Deal " + t.spellPower + " damage";
            return "Spell";
        }
    }
}
