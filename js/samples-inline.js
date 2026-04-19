/**
 * Sample MusicXML scores inlined as ES-module string exports so the app
 * works without a fetch roundtrip — avoids CDN content-type, slashed-branch,
 * and CORS issues when the site is served from static mirrors.
 */

export const hymnXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<!--
  찬송풍 예제 — Hymn-style SATB excerpt in Eb major, 3/4.

  업로드된 찬송가 301장 "지금까지 지내온 것"과 조성(♭3) · 박자(3/4) ·
  4성부(SATB) 구성을 맞춘 8마디 데모입니다. 실제 찬송가 선율의
  전사가 아니라 같은 스타일의 화성 진행 예제입니다.
  Chord plan: I – IV – V7 – I – ii – V – I6 – I
-->
<score-partwise version="4.0">
  <work><work-title>Hymn-style SATB (Eb major, 3/4) — Demo</work-title></work>

  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <score-part id="P2"><part-name>Alto</part-name></score-part>
    <score-part id="P3"><part-name>Tenor</part-name></score-part>
    <score-part id="P4"><part-name>Bass</part-name></score-part>
  </part-list>

  <!-- Soprano -->
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-3</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction><sound tempo="84"/></direction>
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="3">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="5">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="6">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="7">
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="8">
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
  </part>

  <!-- Alto -->
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-3</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="3">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="4">
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="5">
      <note><pitch><step>A</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="6">
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="7">
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="8">
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
  </part>

  <!-- Tenor -->
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-3</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>
      </attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="3">
      <note><pitch><step>A</step><alter>-1</alter><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="4">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="5">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="6">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="7">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="8">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
  </part>

  <!-- Bass -->
  <part id="P4">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-3</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>E</step><alter>-1</alter><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><alter>-1</alter><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="3">
      <note><pitch><step>B</step><alter>-1</alter><octave>2</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><alter>-1</alter><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="5">
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="6">
      <note><pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="7">
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
    <measure number="8">
      <note><pitch><step>E</step><alter>-1</alter><octave>3</octave></pitch><duration>12</duration><type>half</type><dot/></note>
    </measure>
  </part>
</score-partwise>`;

export const satbXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>SATB Amen Cadence (I - IV - V - I)</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <score-part id="P2"><part-name>Alto</part-name></score-part>
    <score-part id="P3"><part-name>Tenor</part-name></score-part>
    <score-part id="P4"><part-name>Bass</part-name></score-part>
  </part-list>

  <!-- Soprano -->
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction><sound tempo="80"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
  </part>

  <!-- Alto -->
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
  </part>

  <!-- Tenor -->
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
  </part>

  <!-- Bass -->
  <part id="P4">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

export const twinkleXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Twinkle Twinkle Little Star</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <!-- Measure 1: C C G G -->
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction><sound tempo="100"/></direction>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 2: A A G - -->
    <measure number="2">
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
    <!-- Measure 3: F F E E -->
    <measure number="3">
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 4: D D C - -->
    <measure number="4">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
    <!-- Measure 5: G G F F -->
    <measure number="5">
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 6: E E D - -->
    <measure number="6">
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
    <!-- Measure 7: G G F F -->
    <measure number="7">
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 8: E E D - -->
    <measure number="8">
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
    <!-- Measure 9: C C G G -->
    <measure number="9">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 10: A A G - -->
    <measure number="10">
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
    <!-- Measure 11: F F E E -->
    <measure number="11">
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
    </measure>
    <!-- Measure 12: D D C - -->
    <measure number="12">
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

export const scaleXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>C Major Scale (3/4 Waltz Tempo)</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Scale</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction><sound tempo="140"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="5">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="6">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;
