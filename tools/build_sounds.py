#!/usr/bin/env python3
"""Copy a curated set of SS13 sound effects into assets/sound and write a manifest."""
import json
import os
import shutil

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, '_src', 'tg2020', 'sound')
OUT = os.path.join(ROOT, 'assets', 'sound')


def seq(prefix, n, start=1, suffix='.ogg'):
    return [prefix + str(i) + suffix for i in range(start, start + n)]


SETS = {
    'door_open': ['machines/airlockopen.ogg'],
    'door_close': ['machines/airlockclose.ogg'],
    'door_forced': ['machines/airlockforced.ogg'],
    'door_denied': ['machines/deniedbeep.ogg'],
    'door_bolt': ['machines/boltsdown.ogg'],
    'door_unbolt': ['machines/boltsup.ogg'],
    'terminal_on': ['machines/terminal_on.ogg'],
    'terminal_off': ['machines/terminal_off.ogg'],
    'terminal_key': ['machines/terminal_button0%d.ogg' % i for i in range(1, 9)],
    'terminal_ok': ['machines/terminal_prompt_confirm.ogg'],
    'terminal_no': ['machines/terminal_prompt_deny.ogg'],
    'terminal_alert': ['machines/terminal_alert.ogg'],
    'alarm': ['machines/alarm.ogg'],
    'beep': ['machines/beep.ogg'],
    'ping': ['machines/ping.ogg'],
    'chime': ['machines/chime.ogg'],
    'twobeep': ['machines/twobeep.ogg'],
    'triple_beep': ['machines/triple_beep.ogg'],
    'synth_yes': ['machines/synth_yes.ogg'],
    'synth_no': ['machines/synth_no.ogg'],
    'vend': ['machines/machine_vend.ogg'],
    'closet_open': ['machines/closet_open.ogg'],
    'closet_close': ['machines/closet_close.ogg'],
    'hiss': ['machines/hiss.ogg'],
    'wind': ['effects/space_wind.ogg'],
    'glass_break': seq('effects/glassbr', 3),
    'glass_hit': ['effects/glasshit.ogg'],
    'explosion': seq('effects/explosion', 3),
    'explosion_far': ['effects/explosion_distant.ogg'],
    'meteor': ['effects/meteorimpact.ogg'],
    'bodyfall': seq('effects/bodyfall', 4),
    'sparks': seq('effects/sparks', 4),
    'zzzt': ['effects/zzzt.ogg'],
    'spray': ['effects/spray.ogg'],
    'extinguish': ['effects/extinguish.ogg'],
    'laser': ['weapons/laser.ogg', 'weapons/laser2.ogg', 'weapons/laser3.ogg'],
    'taser': ['weapons/taser.ogg'],
    'punch': seq('weapons/punch', 4),
    'miss': ['weapons/punchmiss.ogg'],
    'cuff': ['weapons/handcuffs.ogg'],
    'cablecuff': ['weapons/cablecuff.ogg'],
    'grab': ['weapons/thudswoosh.ogg'],
    'baton': ['weapons/genhit1.ogg', 'weapons/genhit2.ogg', 'weapons/genhit3.ogg'],
    'slash': ['weapons/slash.ogg'],
    'bite': ['weapons/bite.ogg'],
    'pain_m': seq('voice/human/malescream_', 6),
    'pain_f': seq('voice/human/femalescream_', 5),
    'heart_fast': ['health/fastbeat.ogg'],
    'heart_slow': ['health/slowbeat.ogg'],
    'pickup': ['items/handling/crowbar_pickup.ogg', 'items/handling/component_pickup.ogg', 'items/handling/cloth_pickup.ogg'],
    'drop': ['items/handling/crowbar_drop.ogg', 'items/handling/component_drop.ogg', 'items/handling/cloth_drop.ogg'],
    'equip': ['items/equip/jumpsuit_equip.ogg', 'items/equip/toolbelt_equip.ogg'],
    'welder': ['items/welder.ogg', 'items/welder2.ogg'],
    'welder_on': ['items/welderactivate.ogg'],
    'wrench': ['items/ratchet.ogg'],
    'screwdriver': ['items/screwdriver.ogg', 'items/screwdriver2.ogg'],
    'wirecutter': ['items/wirecutter.ogg'],
    'crowbar': ['items/crowbar.ogg'],
    'radio_static': ['items/radiostatic.ogg'],
    'step_floor': seq('effects/footstep/floor', 5),
    'step_plating': seq('effects/footstep/plating', 5),
    'step_catwalk': seq('effects/footstep/catwalk', 5),
    'step_carpet': seq('effects/footstep/carpet', 5),
    'step_wood': seq('effects/footstep/wood', 5),
    'amb_station': seq('ambience/ambigen', 8),
    'amb_maint': seq('ambience/ambimaint', 5, start=1) ,
    'amb_space': ['ambience/ambispace.ogg', 'ambience/ambispace2.ogg'],
    'amb_tech': ['ambience/ambitech.ogg', 'ambience/ambitech2.ogg', 'ambience/ambitech3.ogg'],
    'amb_danger': ['ambience/ambidanger.ogg'],
    'announce': ['misc/notice1.ogg'],
    'airraid': ['misc/airraid.ogg'],
}


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    manifest = {}
    used = 0
    for name, files in SETS.items():
        got = []
        for f in files:
            src = os.path.join(SRC, f)
            if not os.path.exists(src):
                continue
            flat = f.replace('/', '__')
            shutil.copy(src, os.path.join(OUT, flat))
            got.append(flat)
            used += os.path.getsize(src)
        if got:
            manifest[name] = got
        else:
            print('missing set', name)
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print(len(manifest), 'sets,', used // 1024, 'KB')


if __name__ == '__main__':
    main()
