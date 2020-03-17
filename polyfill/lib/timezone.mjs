import { ES } from './ecmascript.mjs';
import { MakeIntrinsicClass } from './intrinsicclass.mjs';
import { IDENTIFIER, EPOCHNANOSECONDS, CreateSlots, GetSlot, SetSlot } from './slots.mjs';
import { ZONES } from './zones.mjs';

import bigInt from 'big-integer';

export class TimeZone {
  constructor(timeZoneIdentifier) {
    CreateSlots(this);
    SetSlot(this, IDENTIFIER, ES.GetCanonicalTimeZoneIdentifier(timeZoneIdentifier));
  }
  get name() {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    return String(GetSlot(this, IDENTIFIER));
  }
  getOffsetFor(absolute) {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    if (!ES.IsAbsolute(absolute)) throw new TypeError('invalid Absolute object');
    return ES.GetTimeZoneOffsetString(GetSlot(absolute, EPOCHNANOSECONDS), GetSlot(this, IDENTIFIER));
  }
  getDateTimeFor(absolute) {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    if (!ES.IsAbsolute(absolute)) throw new TypeError('invalid Absolute object');
    const ns = GetSlot(absolute, EPOCHNANOSECONDS);
    const {
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      microsecond,
      nanosecond
    } = ES.GetTimeZoneDateTimeParts(ns, GetSlot(this, IDENTIFIER));
    const DateTime = ES.GetIntrinsic('%Temporal.DateTime%');
    return new DateTime(year, month, day, hour, minute, second, millisecond, microsecond, nanosecond);
  }
  getAbsoluteFor(dateTime, options) {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    dateTime = ES.ToDateTime(dateTime, 'reject');
    const disambiguation = ES.ToTimeZoneDisambiguation(options);

    const Absolute = ES.GetIntrinsic('%Temporal.Absolute%');
    const { year, month, day, hour, minute, second, millisecond, microsecond, nanosecond } = dateTime;
    const possibleEpochNs = ES.GetTimeZoneEpochValue(
      GetSlot(this, IDENTIFIER),
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      microsecond,
      nanosecond
    );
    if (possibleEpochNs.length === 1) return new Absolute(possibleEpochNs[0]);
    if (possibleEpochNs.length) {
      switch (disambiguation) {
        case 'earlier':
          return new Absolute(possibleEpochNs[0]);
        case 'later':
          return new Absolute(possibleEpochNs[1]);
        case 'reject': {
          throw new RangeError(`multiple absolute found`);
        }
      }
    }


    const utcns = ES.GetEpochFromParts(
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      microsecond,
      nanosecond
    );
    if (utcns === null) throw new RangeError('DateTime outside of supported range');
    const before = ES.GetTimeZoneOffsetNanoseconds(utcns.minus(bigInt(86400 * 1e9)), GetSlot(this, IDENTIFIER));
    const after = ES.GetTimeZoneOffsetNanoseconds(utcns.plus(bigInt(86400 * 1e9)), GetSlot(this, IDENTIFIER));
    const diff = ES.ToDuration({
      nanoseconds: after.minus(before)
    }, 'reject');
    switch (disambiguation) {
      case 'earlier': {
        const earlier = dateTime.minus(diff);
        return this.getAbsoluteFor(earlier, disambiguation);
      }
      case 'later': {
        const later = dateTime.plus(diff);
        return this.getAbsoluteFor(later, disambiguation);
      }
      case 'reject': {
        throw new RangeError(`no such absolute found`);
      }
    }
  }
  getTransitions(startingPoint) {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    if (!ES.IsAbsolute(startingPoint)) throw new TypeError('invalid Absolute object');
    let epochNanoseconds = GetSlot(startingPoint, EPOCHNANOSECONDS);
    const Absolute = ES.GetIntrinsic('%Temporal.Absolute%');
    const timeZone = GetSlot(this, IDENTIFIER);
    const result = {
      next: () => {
        epochNanoseconds = ES.GetTimeZoneNextTransition(epochNanoseconds, timeZone);
        const done = epochNanoseconds === null;
        const value = epochNanoseconds === null ? null : new Absolute(epochNanoseconds);
        return { done, value };
      }
    };
    if (typeof Symbol === 'function') {
      result[Symbol.iterator] = ()=>result;
    }
    return result;
  }
  toString() {
    if (!ES.IsTimeZone(this)) throw new TypeError('invalid receiver');
    return this.name;
  }
  static from(arg) {
    let result = ES.ToTimeZone(arg);
    if (this === TimeZone) return result;
    return new this(GetSlot(result, IDENTIFIER));
  }
}

TimeZone.prototype.toJSON = TimeZone.prototype.toString;

if ('undefined' !== typeof Symbol) {
  TimeZone[Symbol.iterator] = function() {
    const iter = ZONES[Symbol.iterator]();
    return {
      next: () => {
        while (true) {  // eslint-disable-line no-constant-condition
          let { value, done } = iter.next();
          if (done) return { done };
          try {
            value = new TimeZone(value);
            done = false;
            return { done, value };
          } catch (ex) {
            continue;
          }
        }
      }
    };
  };
}

MakeIntrinsicClass(TimeZone, 'Temporal.TimeZone');