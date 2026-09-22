// "sfp28-5-SERVER HCM" -> family "sfp28", number "5"; "qsfp28-1-1" -> "qsfp28", "1-1"; "ether1-PAM" -> "ether", "1"; "Gi0/1" -> "Gi", "0/1"
// "sfp-sfpplus1" -> family "sfpplus", number "1" (MikroTik combo ports: a namespace prefix, then the real type+number)
export function parsePortFamily(name: string): { family: string; label: string } {
  const lastHyphen = name.lastIndexOf("-");
  if (lastHyphen !== -1) {
    const tail = /^([A-Za-z]+)(\d+(?:[-/.]\d+)*)$/.exec(name.slice(lastHyphen + 1));
    if (tail) return { family: tail[1], label: tail[2] };
  }
  const hyphen = /^([A-Za-z]+\d*)-(\d+(?:[-/.]\d+)*)/.exec(name);
  if (hyphen) return { family: hyphen[1], label: hyphen[2] };
  const plain = /^([A-Za-z]+)\s?(\d+(?:[/.]\d+)*)/.exec(name);
  if (plain) return { family: plain[1], label: plain[2] };
  return { family: "other", label: name.slice(0, 4) };
}
