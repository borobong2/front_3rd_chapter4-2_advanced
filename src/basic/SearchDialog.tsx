import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Box,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { Lecture } from "./types.ts";
import { parseSchedule } from "./utils.ts";
import axios from "axios";
import { DAY_LABELS } from "./constants.ts";
import LectureTable from "./LectureTable.tsx";

interface Props {
  searchInfo: {
    tableId: string;
    day?: string;
    time?: number;
  } | null;
  onClose: () => void;
}

interface SearchOption {
  query?: string;
  grades: number[];
  days: string[];
  times: number[];
  majors: string[];
  credits?: number;
}

const TIME_SLOTS = [
  { id: 1, label: "09:00~09:30" },
  { id: 2, label: "09:30~10:00" },
  { id: 3, label: "10:00~10:30" },
  { id: 4, label: "10:30~11:00" },
  { id: 5, label: "11:00~11:30" },
  { id: 6, label: "11:30~12:00" },
  { id: 7, label: "12:00~12:30" },
  { id: 8, label: "12:30~13:00" },
  { id: 9, label: "13:00~13:30" },
  { id: 10, label: "13:30~14:00" },
  { id: 11, label: "14:00~14:30" },
  { id: 12, label: "14:30~15:00" },
  { id: 13, label: "15:00~15:30" },
  { id: 14, label: "15:30~16:00" },
  { id: 15, label: "16:00~16:30" },
  { id: 16, label: "16:30~17:00" },
  { id: 17, label: "17:00~17:30" },
  { id: 18, label: "17:30~18:00" },
  { id: 19, label: "18:00~18:50" },
  { id: 20, label: "18:55~19:45" },
  { id: 21, label: "19:50~20:40" },
  { id: 22, label: "20:45~21:35" },
  { id: 23, label: "21:40~22:30" },
  { id: 24, label: "22:35~23:25" },
];

const PAGE_SIZE = 100;

const fetchMajors = () => axios.get<Lecture[]>("/schedules-majors.json");
const fetchLiberalArts = () =>
  axios.get<Lecture[]>("/schedules-liberal-arts.json");

// TODO: 이 코드를 개선해서 API 호출을 최소화 해보세요 + Promise.all이 현재 잘못 사용되고 있습니다. 같이 개선해주세요.
const createCachedFetch = () => {
  const cache: Record<string, Promise<{ data: Lecture[] }>> = {};

  return {
    fetchMajorsWithCache: () => {
      if (!cache["majors"]) {
        console.log("API Call - Majors", performance.now());
        cache["majors"] = fetchMajors();
      }
      return cache["majors"];
    },
    fetchLiberalArtsWithCache: () => {
      if (!cache["liberalArts"]) {
        console.log("API Call - Liberal Arts", performance.now());
        cache["liberalArts"] = fetchLiberalArts();
      }
      return cache["liberalArts"];
    },
  };
};

const { fetchMajorsWithCache, fetchLiberalArtsWithCache } = createCachedFetch();

const fetchAllLectures = async () =>
  await Promise.all([
    fetchMajorsWithCache(),
    fetchLiberalArtsWithCache(),
    fetchMajorsWithCache(),
    fetchLiberalArtsWithCache(),
    fetchMajorsWithCache(),
    fetchLiberalArtsWithCache(),
  ]);

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: "",
    grades: [],
    days: [],
    times: [],
    majors: [],
  });

  const filteredLectures = useMemo(() => {
    const { query = "", credits, grades, days, times, majors } = searchOptions;
    return lectures.filter((lecture) => {
      if (
        query &&
        !lecture.title.toLowerCase().includes(query.toLowerCase()) &&
        !lecture.id.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (grades.length > 0 && !grades.includes(lecture.grade)) return false;
      if (majors.length > 0 && !majors.includes(lecture.major)) return false;
      if (credits && !lecture.credits.startsWith(String(credits))) return false;

      const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
      if (days.length > 0 && !schedules.some((s) => days.includes(s.day)))
        return false;
      if (
        times.length > 0 &&
        !schedules.some((s) => s.range.some((time) => times.includes(time)))
      )
        return false;

      return true;
    });
  }, [lectures, searchOptions]);

  const lastPage = useMemo(
    () => Math.ceil(filteredLectures.length / PAGE_SIZE),
    [filteredLectures.length]
  );

  const visibleLectures = useMemo(
    () => filteredLectures.slice(0, page * PAGE_SIZE),
    [filteredLectures, page]
  );

  const allMajors = useMemo(
    () => [...new Set(lectures.map((lecture) => lecture.major))],
    [lectures]
  );

  const changeSearchOption = useCallback(
    (field: keyof SearchOption, value: SearchOption[typeof field]) => {
      setPage(1);
      setSearchOptions((prev) => ({ ...prev, [field]: value }));
      loaderWrapperRef.current?.scrollTo(0, 0);
    },
    []
  );

  useEffect(() => {
    const start = performance.now();
    console.log("API 호출 시작: ", start);
    fetchAllLectures().then((results) => {
      const end = performance.now();
      console.log("모든 API 호출 완료 ", end);
      console.log("API 호출에 걸린 시간(ms): ", end - start);
      setLectures(results.flatMap((result) => result.data));
    });
  }, []);

  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prevPage) => Math.min(lastPage, prevPage + 1));
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);
    return () => observer.unobserve($loader);
  }, [lastPage]);

  useEffect(() => {
    setSearchOptions((prev) => ({
      ...prev,
      days: searchInfo?.day ? [searchInfo.day] : [],
      times: searchInfo?.time ? [searchInfo.time] : [],
    }));
    setPage(1);
  }, [searchInfo]);

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>검색어</FormLabel>
                <Input
                  placeholder="과목명 또는 과목코드"
                  value={searchOptions.query}
                  onChange={(e) => changeSearchOption("query", e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>학점</FormLabel>
                <Select
                  value={searchOptions.credits}
                  onChange={(e) =>
                    changeSearchOption("credits", e.target.value)
                  }
                >
                  <option value="">전체</option>
                  <option value="1">1학점</option>
                  <option value="2">2학점</option>
                  <option value="3">3학점</option>
                </Select>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>학년</FormLabel>
                <CheckboxGroup
                  value={searchOptions.grades}
                  onChange={(value) =>
                    changeSearchOption("grades", value.map(Number))
                  }
                >
                  <HStack spacing={4}>
                    {[1, 2, 3, 4].map((grade) => (
                      <Checkbox key={grade} value={grade}>
                        {grade}학년
                      </Checkbox>
                    ))}
                  </HStack>
                </CheckboxGroup>
              </FormControl>

              <FormControl>
                <FormLabel>요일</FormLabel>
                <CheckboxGroup
                  value={searchOptions.days}
                  onChange={(value) =>
                    changeSearchOption("days", value as string[])
                  }
                >
                  <HStack spacing={4}>
                    {DAY_LABELS.map((day) => (
                      <Checkbox key={day} value={day}>
                        {day}
                      </Checkbox>
                    ))}
                  </HStack>
                </CheckboxGroup>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>시간</FormLabel>
                <CheckboxGroup
                  colorScheme="green"
                  value={searchOptions.times}
                  onChange={(values) =>
                    changeSearchOption("times", values.map(Number))
                  }
                >
                  <Wrap spacing={1} mb={2}>
                    {searchOptions.times
                      .sort((a, b) => a - b)
                      .map((time) => (
                        <Tag
                          key={time}
                          size="sm"
                          variant="outline"
                          colorScheme="blue"
                        >
                          <TagLabel>{time}교시</TagLabel>
                          <TagCloseButton
                            onClick={() =>
                              changeSearchOption(
                                "times",
                                searchOptions.times.filter((v) => v !== time)
                              )
                            }
                          />
                        </Tag>
                      ))}
                  </Wrap>
                  <Stack
                    spacing={2}
                    overflowY="auto"
                    h="100px"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius={5}
                    p={2}
                  >
                    {TIME_SLOTS.map(({ id, label }) => (
                      <Box key={id}>
                        <Checkbox key={id} size="sm" value={id}>
                          {id}교시({label})
                        </Checkbox>
                      </Box>
                    ))}
                  </Stack>
                </CheckboxGroup>
              </FormControl>

              <FormControl>
                <FormLabel>전공</FormLabel>
                <CheckboxGroup
                  colorScheme="green"
                  value={searchOptions.majors}
                  onChange={(values) =>
                    changeSearchOption("majors", values as string[])
                  }
                >
                  <Wrap spacing={1} mb={2}>
                    {searchOptions.majors.map((major) => (
                      <Tag
                        key={major}
                        size="sm"
                        variant="outline"
                        colorScheme="blue"
                      >
                        <TagLabel>{major.split("<p>").pop()}</TagLabel>
                        <TagCloseButton
                          onClick={() =>
                            changeSearchOption(
                              "majors",
                              searchOptions.majors.filter((v) => v !== major)
                            )
                          }
                        />
                      </Tag>
                    ))}
                  </Wrap>
                  <Stack
                    spacing={2}
                    overflowY="auto"
                    h="100px"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius={5}
                    p={2}
                  >
                    {allMajors.map((major) => (
                      <Box key={major}>
                        <Checkbox key={major} size="sm" value={major}>
                          {major.replace(/<p>/gi, " ")}
                        </Checkbox>
                      </Box>
                    ))}
                  </Stack>
                </CheckboxGroup>
              </FormControl>
            </HStack>
            <Text align="right">검색결과: {filteredLectures.length}개</Text>
            <LectureTable
              loaderWrapperRef={loaderWrapperRef}
              visibleLectures={visibleLectures}
              loaderRef={loaderRef}
              searchInfo={searchInfo}
              onClose={onClose}
            />
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SearchDialog;
