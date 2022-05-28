export enum raceClass {
  CLASS_5 = "Class V",
  CLASS_4 = "Class IV",
  CLASS_3 = "Class III",
  CLASS_2 = "Class II",
  CLASS_1 = "Class I",
}

export const raceFees = {
  [raceClass.CLASS_5]: 70,
  [raceClass.CLASS_4]: 100,
  [raceClass.CLASS_3]: 135,
  [raceClass.CLASS_2]: 190,
  [raceClass.CLASS_1]: 250,
};

export const gains = {
  [raceClass.CLASS_5]: [286, 189, 3, 126, 5, 42, 0, 0, 0, 0, 0, 0],
  [raceClass.CLASS_4]: [0, 0, 240, 180, 120, 6, 0, 0, 0, 0, 0, 0],
  [raceClass.CLASS_3]: [0, 0, 324, 180, 120, 81, 0, 0, 0, 0, 0, 0],
  [raceClass.CLASS_2]: [190],
  [raceClass.CLASS_1]: [250],
};

export const mmrGains = [30, 2, 15, 10, 10, 10, 10, -10, -10, 0, -30, -40];
