/** Shared writing guidance. This does not authorize paid drafting/review calls. */
export const SERIAL_COMMA_RULE = "Use an Oxford comma before the final and/or in every genuine list of three or more items (pain, stiffness, and weakness). Do not add commas to two-item pairs, ordinary clauses, or URLs. Preserve clinical meaning; rewrite ambiguous lists manually rather than guessing.";

// Recognize only flat, short phrase lists. This is a conservative lint, not an English parser:
// complex clauses and nested conjunctions remain a local reviewer responsibility.
const CLAUSE_WORDS = /\b(?:if|when|while|because|although|but|which|who|that|where|after|before|without|despite|followed|associated|is|are|was|were|has|have|had|shows?|reveals?|causes?|worsens?|improves?|remains?|reports?|suggests?|found|seen)\b/i;
const MODIFIER_START = /^(?:initially|typically|generally|usually|normally|sometimes|occasionally|often|overall|however|therefore|finally|instead|alternatively|subsequently|otherwise|also|especially|particularly|mainly|mostly|notably|including|such as|first|next|then|second|plus|along with|accompanied by)\b/i;

export function serialCommaProblems(text: string): string[] {
  const problems: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Mask URLs for checking; leave the original text completely untouched.
    const prose = line.replace(/https?:\/\/\S+|\b(?:[a-z0-9-]+\.)+(?:com|org|net)(?:\/\S*)?/gi, "");
    for (const sentence of prose.split(/[.!?;:]/)) {
      const body = sentence.trim().replace(/^(?:(?:a|an) patient (?:came in )?with|(?:imagine|consider) a patient with|(?:symptoms|findings|options|treatment) include(?:s)?)\s+/i, "");
      const pieces = body.split(",").map(s => s.trim());
      if (pieces.length < 2 || pieces.some(s => !s)) continue;
      if (MODIFIER_START.test(pieces[0]) || /^\w+ly$/i.test(pieces[0])) continue;
      // An introductory phrase followed by a pair is not a three-item list.
      if (/^(?:in|for|at|on|with|from|after|before|during|despite|without|by|as|to|near|over|under|around)\b/i.test(pieces[0])) continue;
      const last = pieces.pop()!;
      // An existing final comma (including a two-clause ', and') is not an error.
      if (/^(?:and|or)\b/i.test(last)) continue;
      const tail = last.split(/\s+(?:and|or)\s+/i);
      if (tail.length !== 2) continue;
      if (MODIFIER_START.test(tail[0])) continue;
      if (/^(?:in|at|on|near|over|under|around|beside|from|with|through|during|for|by)\b/i.test(tail[0])) continue;
      const items = [...pieces, ...tail];
      if (items.some(s => CLAUSE_WORDS.test(s) || /\b(?:and|or)\b/i.test(s) || s.split(/\s+/).length > 8 || !/^[\p{L}\p{N}\s'\u2019-]+$/u.test(s))) continue;
      problems.push(`Missing Oxford comma in a ${items.length}-item list: ${body}`);
    }
  }
  return problems;
}

export function assertSerialCommas(text: string): void {
  const problems = serialCommaProblems(text);
  if (problems.length) throw new Error(problems.join("; ") + ". Rewrite the list explicitly; copy was not changed.");
}
