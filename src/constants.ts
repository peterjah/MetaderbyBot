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
